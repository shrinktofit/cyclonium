import { createHash } from 'node:crypto';
import { posix } from 'node:path';

import type {
  CatalogArtifactIndex,
  IndexedAsset,
  IndexedNativeArtifact,
} from './artifact-index.js';
import {
  AssetGroupEntryKind,
  type AssetGroup,
  type AssetGroupEntry,
  type AssetPipelineAuthoringData,
} from '../asset-groups/authoring/index.js';
import {
  ASSET_CATALOG_SCHEMA_VERSION,
  type AssetCatalogPointer,
  type SerializedArtifactCandidate,
  type SerializedAssetCatalog,
  type SerializedAssetRecord,
} from './catalog-wire-format.js';

const COCOS_IMPORT_DECODER_ID = 'cocos-import';

export interface CompiledAssetCatalog {
  readonly catalog: SerializedAssetCatalog;
  readonly bytes: Uint8Array;
  readonly sha256: string;
  readonly revision: string;
}

export interface ExpandedCatalogEntry {
  readonly group: AssetGroup;
  readonly entry: AssetGroupEntry;
  readonly assetUuid: string;
  readonly assetUrl: string;
  readonly runtimeTypeId: string;
  readonly address: string;
  readonly labels: readonly string[];
  readonly order: number;
}

export class CatalogCompileError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CatalogCompileError';
  }
}

export async function compileAssetCatalog(
  authoring: AssetPipelineAuthoringData,
  artifactIndex: CatalogArtifactIndex,
): Promise<CompiledAssetCatalog> {
  const expandedEntries = await expandCatalogEntries(authoring, artifactIndex);
  const rootOrder = new Map<string, number>();
  for (const expandedEntry of expandedEntries) {
    rootOrder.set(expandedEntry.assetUuid, expandedEntry.order);
  }

  const indexedAssets = await collectDependencyClosure(
    expandedEntries.map((entry) => entry.assetUuid),
    artifactIndex,
  );
  const orderedAssets = [...indexedAssets.values()].sort((left, right) => {
    const leftOrder = rootOrder.get(left.uuid) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = rootOrder.get(right.uuid) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.uuid.localeCompare(right.uuid);
  });

  const keys = new Map<string, string[]>();
  for (const expandedEntry of expandedEntries) {
    const { group } = expandedEntry;
    if (group.includeAddressInCatalog) {
      appendKey(keys, expandedEntry.address, expandedEntry.assetUuid);
    }
    if (group.includeGuidsInCatalog) {
      appendKey(keys, expandedEntry.assetUuid, expandedEntry.assetUuid);
    }
    if (group.includeLabelsInCatalog) {
      for (const label of expandedEntry.labels) {
        appendKey(keys, label, expandedEntry.assetUuid);
      }
    }
  }

  const records = orderedAssets.map(toSerializedRecord);
  const catalog: SerializedAssetCatalog = {
    type: 'cyclo-asset-catalog',
    version: ASSET_CATALOG_SCHEMA_VERSION,
    keys: [...keys].map(([key, resourceIds]) => ({ key, resourceIds })),
    cocosUuids: orderedAssets.map((asset) => ({
      uuid: asset.uuid,
      resourceId: asset.uuid,
    })),
    records,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(catalog));
  const revision = createHash('sha256').update(bytes).digest('hex');
  return {
    catalog,
    bytes,
    sha256: `sha256:${revision}`,
    revision,
  };
}

export function createCatalogPointer(
  catalog: CompiledAssetCatalog,
  url: string,
): AssetCatalogPointer {
  return {
    type: 'cyclo-asset-catalog-pointer',
    version: ASSET_CATALOG_SCHEMA_VERSION,
    url,
    sha256: catalog.sha256,
    byteLength: catalog.bytes.byteLength,
  };
}

export async function expandCatalogEntries(
  authoring: AssetPipelineAuthoringData,
  artifactIndex: CatalogArtifactIndex,
): Promise<readonly ExpandedCatalogEntry[]> {
  const enabledGroups = authoring.groups.filter((group) => group.includeInBuild);
  const explicitAssets = new Map<string, AssetGroupEntry>();
  for (const group of enabledGroups) {
    for (const entry of group.entries) {
      if (entry.kind === AssetGroupEntryKind.directory) {
        continue;
      }
      const previous = explicitAssets.get(entry.assetUuid);
      if (previous !== undefined) {
        throw new CatalogCompileError(
          `Asset "${entry.assetUuid}" is explicitly assigned by entries `
          + `"${previous.id}" and "${entry.id}".`,
        );
      }
      explicitAssets.set(entry.assetUuid, entry);
    }
  }

  interface ExpansionCandidate {
    readonly group: AssetGroup;
    readonly entry: AssetGroupEntry;
    readonly asset: IndexedAsset;
    readonly address: string;
    readonly specificity: number;
    readonly order: number;
  }

  const candidates = new Map<string, ExpansionCandidate>();
  let order = 0;
  for (const group of enabledGroups) {
    for (const entry of group.entries) {
      if (entry.kind !== AssetGroupEntryKind.directory) {
        const asset = await requireAsset(artifactIndex, entry.assetUuid, entry.id);
        if (asset.isDirectory) {
          throw new CatalogCompileError(
            `Entry "${entry.id}" is declared as an asset but points to a directory.`,
          );
        }
        candidates.set(asset.uuid, {
          group,
          entry,
          asset,
          address: entry.address,
          specificity: Number.MAX_SAFE_INTEGER,
          order,
        });
        order += 1;
        continue;
      }

      const directory = await requireAsset(artifactIndex, entry.assetUuid, entry.id);
      if (!directory.isDirectory) {
        throw new CatalogCompileError(
          `Directory entry "${entry.id}" does not point to a directory.`,
        );
      }
      const specificity = pathDepth(directory.url);
      const children = [...await artifactIndex.queryAssetsUnder(directory.url)]
        .filter((asset) => !asset.isDirectory)
        .sort((left, right) => left.url.localeCompare(right.url));
      for (const child of children) {
        if (explicitAssets.has(child.uuid)) {
          continue;
        }
        const relativeUrl = relativeAssetUrl(directory.url, child.url);
        const candidate: ExpansionCandidate = {
          group,
          entry,
          asset: child,
          address: joinAddress(entry.address, relativeUrl),
          specificity,
          order,
        };
        order += 1;
        const previous = candidates.get(child.uuid);
        if (
          previous === undefined
          || candidate.specificity > previous.specificity
        ) {
          candidates.set(child.uuid, candidate);
        }
      }
    }
  }

  return [...candidates.values()]
    .sort((left, right) => left.order - right.order)
    .map((candidate, entryOrder) => ({
      group: candidate.group,
      entry: candidate.entry,
      assetUuid: candidate.asset.uuid,
      assetUrl: candidate.asset.url,
      runtimeTypeId: candidate.asset.runtimeTypeId,
      address: candidate.address,
      labels: candidate.entry.labels,
      order: entryOrder,
    }));
}

async function collectDependencyClosure(
  rootUuids: readonly string[],
  artifactIndex: CatalogArtifactIndex,
): Promise<Map<string, IndexedAsset>> {
  const assets = new Map<string, IndexedAsset>();
  const pending = [...rootUuids];
  while (pending.length > 0) {
    const uuid = pending.shift();
    if (uuid === undefined || assets.has(uuid)) {
      continue;
    }
    const asset = await requireAsset(artifactIndex, uuid, uuid);
    if (asset.isDirectory) {
      throw new CatalogCompileError(
        `Directory "${asset.url}" entered the runtime dependency graph.`,
      );
    }
    assets.set(uuid, asset);
    for (const dependencyUuid of asset.directDependencies) {
      if (!assets.has(dependencyUuid)) {
        pending.push(dependencyUuid);
      }
    }
  }
  return assets;
}

function toSerializedRecord(asset: IndexedAsset): SerializedAssetRecord {
  if (asset.primaryArtifact === undefined) {
    throw new CatalogCompileError(
      `Asset "${asset.url}" (${asset.uuid}) has no standalone JSON, CCONB, or BINP-v2 import artifact.`,
    );
  }
  const nativeVariants = new Map<string, IndexedNativeArtifact>();
  for (const nativeArtifact of asset.nativeArtifacts) {
    const variant = nativeArtifact.variant ?? '<fallback>';
    const previous = nativeVariants.get(variant);
    if (previous !== undefined) {
      throw new CatalogCompileError(
        `Asset "${asset.url}" (${asset.uuid}) has multiple native candidates for `
        + `variant "${variant}": "${previous.location.key}" and `
        + `"${nativeArtifact.location.key}".`,
      );
    }
    nativeVariants.set(variant, nativeArtifact);
  }
  const auxiliaryArtifactSets = asset.nativeArtifacts.length === 0
    ? []
    : [{
      slot: 'native',
      candidates: [...asset.nativeArtifacts]
        .sort((left, right) => (
          (left.variant ?? '').localeCompare(right.variant ?? '')
          || left.location.key.localeCompare(right.location.key)
        ))
        .map(toSerializedCandidate),
    }];
  return {
    resourceId: asset.uuid,
    cocosUuid: asset.uuid,
    runtimeTypeId: asset.runtimeTypeId,
    primaryArtifact: asset.primaryArtifact,
    auxiliaryArtifactSets,
    directDependencies: [...new Set(asset.directDependencies)].sort(),
    decoderId: COCOS_IMPORT_DECODER_ID,
  };
}

function toSerializedCandidate(
  artifact: IndexedNativeArtifact,
): SerializedArtifactCandidate {
  return {
    ...(artifact.variant === undefined ? {} : { variant: artifact.variant }),
    location: artifact.location,
  };
}

function appendKey(keys: Map<string, string[]>, key: string, resourceId: string): void {
  const normalizedKey = key.trim();
  if (normalizedKey.length === 0) {
    throw new CatalogCompileError('Catalog keys must not be empty.');
  }
  const locations = keys.get(normalizedKey);
  if (locations === undefined) {
    keys.set(normalizedKey, [resourceId]);
  } else if (!locations.includes(resourceId)) {
    locations.push(resourceId);
  }
}

async function requireAsset(
  artifactIndex: CatalogArtifactIndex,
  uuid: string,
  entryId: string,
): Promise<IndexedAsset> {
  const asset = await artifactIndex.queryAsset(uuid);
  if (asset === undefined) {
    throw new CatalogCompileError(
      `Entry "${entryId}" references missing asset "${uuid}".`,
    );
  }
  return asset;
}

function pathDepth(url: string): number {
  return normalizeUrl(url).split('/').length;
}

function relativeAssetUrl(directoryUrl: string, assetUrl: string): string {
  const directory = normalizeUrl(directoryUrl);
  const asset = normalizeUrl(assetUrl);
  const prefix = `${directory}/`;
  if (!asset.startsWith(prefix)) {
    throw new CatalogCompileError(
      `Asset URL "${assetUrl}" is not inside directory "${directoryUrl}".`,
    );
  }
  return asset.slice(prefix.length);
}

function joinAddress(base: string, relativeUrl: string): string {
  const normalizedBase = base.trim().replace(/\/+$/u, '');
  if (normalizedBase.length === 0) {
    return relativeUrl;
  }
  return posix.join(normalizedBase, relativeUrl);
}

function normalizeUrl(url: string): string {
  return url.replace(/\\/gu, '/').replace(/\/+$/u, '');
}
