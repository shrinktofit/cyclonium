import { AbortController } from '@cyclonium/abort-controller';

import { releaseArtifact } from './core/artifact-lifetime.js';
import type {
  ArtifactSource,
  Sha256,
} from './core/contracts.js';
import {
  ArtifactEntryKind,
  ArtifactKind,
  type ArtifactCandidate,
  type ArtifactLocation,
  type AssetCatalog,
  type AssetRecord,
  type AuxiliaryArtifactSet,
} from './core/model.js';
import {
  AssetPipelineInstallError,
  AssetPipelineInstallStage,
} from './core/public.js';
import { decodeUtf8 } from './core/utf8.js';

const CATALOG_POINTER_TYPE = 'cyclo-asset-catalog-pointer';
const CATALOG_TYPE = 'cyclo-asset-catalog';
const CATALOG_SCHEMA_VERSION = 1;
const SHA256_PATTERN = /^sha256:([0-9a-f]{64})$/i;

interface AssetCatalogPointer {
  readonly url: string;
  readonly sha256: string;
  readonly byteLength: number;
}

export async function acquireAssetCatalog(
  pointerValue: unknown,
  source: ArtifactSource,
  sha256: Sha256,
): Promise<AssetCatalog> {
  const pointer = parseCatalogPointer(pointerValue);
  const controller = new AbortController();
  let artifact;
  try {
    artifact = await source.acquire({
      sourceId: source.id,
      key: pointer.url,
      format: 'json',
      byteSize: pointer.byteLength,
      preferredKind: ArtifactKind.bytes,
    }, controller.signal);
  } catch (error) {
    throw new AssetPipelineInstallError(
      AssetPipelineInstallStage.acquire,
      `Could not acquire Asset Catalog "${pointer.url}".`,
      { cause: error },
    );
  }

  try {
    if (artifact.kind !== ArtifactKind.bytes) {
      const cause = new TypeError(
        `Catalog Source returned Artifact kind "${artifact.kind}".`,
      );
      throw new AssetPipelineInstallError(
        AssetPipelineInstallStage.acquire,
        `Asset Catalog "${pointer.url}" did not produce byte content.`,
        { cause },
      );
    }
    await verifyCatalogIntegrity(pointer, artifact.bytes, sha256);
    return parseCatalogBytes(artifact.bytes, source.id, pointer.sha256);
  } finally {
    releaseArtifact(artifact);
  }
}

function parseCatalogPointer(value: unknown): AssetCatalogPointer {
  try {
    const pointer = requireObject(value, 'Asset Catalog pointer');
    requireExactKeys(
      pointer,
      ['type', 'version', 'url', 'sha256', 'byteLength'],
      'Asset Catalog pointer',
    );
    requireExactValue(pointer.type, CATALOG_POINTER_TYPE, 'pointer.type');
    requireExactValue(
      pointer.version,
      CATALOG_SCHEMA_VERSION,
      'pointer.version',
    );
    const url = requireNonEmptyString(pointer.url, 'pointer.url');
    const expectedHash = requireNonEmptyString(
      pointer.sha256,
      'pointer.sha256',
    );
    if (!SHA256_PATTERN.test(expectedHash)) {
      throw new TypeError(
        'pointer.sha256 must be sha256:<64 hexadecimal characters>.',
      );
    }
    const byteLength = requireNonNegativeInteger(
      pointer.byteLength,
      'pointer.byteLength',
    );
    return {
      url,
      sha256: expectedHash,
      byteLength,
    };
  } catch (error) {
    throw new AssetPipelineInstallError(
      AssetPipelineInstallStage.settings,
      'The Cyclo Asset Catalog settings pointer is invalid.',
      { cause: error },
    );
  }
}

async function verifyCatalogIntegrity(
  pointer: AssetCatalogPointer,
  bytes: Uint8Array,
  sha256: Sha256,
): Promise<void> {
  try {
    if (bytes.byteLength !== pointer.byteLength) {
      throw new Error(
        `Catalog length is ${bytes.byteLength}; expected ${pointer.byteLength}.`,
      );
    }
    const digest = await sha256(bytes);
    if (digest.byteLength !== 32) {
      throw new Error(
        `SHA-256 implementation returned ${digest.byteLength} bytes.`,
      );
    }
    const actualHash = `sha256:${toHex(digest)}`;
    if (actualHash !== pointer.sha256.toLowerCase()) {
      throw new Error(
        `Catalog hash is ${actualHash}; expected ${pointer.sha256}.`,
      );
    }
  } catch (error) {
    throw new AssetPipelineInstallError(
      AssetPipelineInstallStage.integrity,
      'Asset Catalog integrity verification failed.',
      { cause: error },
    );
  }
}

function parseCatalogBytes(
  bytes: Uint8Array,
  sourceId: string,
  revision: string,
): AssetCatalog {
  try {
    const document: unknown = JSON.parse(decodeUtf8(bytes));
    return parseCatalogDocument(document, sourceId, revision.toLowerCase());
  } catch (error) {
    throw new AssetPipelineInstallError(
      AssetPipelineInstallStage.parse,
      'Asset Catalog parsing failed.',
      { cause: error },
    );
  }
}

function parseCatalogDocument(
  value: unknown,
  sourceId: string,
  revision: string,
): AssetCatalog {
  const document = requireObject(value, 'Asset Catalog');
  requireExactKeys(
    document,
    ['type', 'version', 'keys', 'cocosUuids', 'records'],
    'Asset Catalog',
  );
  requireExactValue(document.type, CATALOG_TYPE, 'catalog.type');
  requireExactValue(
    document.version,
    CATALOG_SCHEMA_VERSION,
    'catalog.version',
  );

  const recordValues = requireArray(document.records, 'catalog.records');
  const records = new Map<string, AssetRecord>();
  for (const [index, recordValue] of recordValues.entries()) {
    const record = parseAssetRecord(
      recordValue,
      sourceId,
      revision,
      `catalog.records[${index}]`,
    );
    addUnique(records, record.resourceId, record, 'record resourceId');
  }

  const keyValues = requireArray(document.keys, 'catalog.keys');
  const keys = new Map<string, readonly string[]>();
  for (const [index, keyValue] of keyValues.entries()) {
    const path = `catalog.keys[${index}]`;
    const entry = requireObject(keyValue, path);
    requireExactKeys(entry, ['key', 'resourceIds'], path);
    const key = requireNonEmptyString(entry.key, `${path}.key`);
    const resourceIds = requireStringArray(
      entry.resourceIds,
      `${path}.resourceIds`,
    );
    if (resourceIds.length === 0) {
      throw new TypeError(`${path}.resourceIds must not be empty.`);
    }
    for (const resourceId of resourceIds) {
      if (!records.has(resourceId)) {
        throw new TypeError(
          `${path} references unknown resource "${resourceId}".`,
        );
      }
    }
    addUnique(
      keys,
      key,
      Object.freeze(resourceIds),
      'Catalog key',
    );
  }

  const uuidValues = requireArray(
    document.cocosUuids,
    'catalog.cocosUuids',
  );
  const cocosUuids = new Map<string, string>();
  for (const [index, uuidValue] of uuidValues.entries()) {
    const path = `catalog.cocosUuids[${index}]`;
    const entry = requireObject(uuidValue, path);
    requireExactKeys(entry, ['uuid', 'resourceId'], path);
    const uuid = requireNonEmptyString(entry.uuid, `${path}.uuid`);
    const resourceId = requireNonEmptyString(
      entry.resourceId,
      `${path}.resourceId`,
    );
    if (!records.has(resourceId)) {
      throw new TypeError(
        `${path} references unknown resource "${resourceId}".`,
      );
    }
    addUnique(cocosUuids, uuid, resourceId, 'Cocos UUID');
  }

  for (const record of records.values()) {
    if (
      record.cocosUuid !== undefined
      && cocosUuids.get(record.cocosUuid) !== record.resourceId
    ) {
      throw new TypeError(
        `Record "${record.resourceId}" Cocos UUID "${record.cocosUuid}" `
        + 'is missing from or conflicts with catalog.cocosUuids.',
      );
    }
    for (const dependency of record.directDependencies) {
      if (!records.has(dependency)) {
        throw new TypeError(
          `Record "${record.resourceId}" references unknown dependency `
          + `"${dependency}".`,
        );
      }
    }
  }

  return {
    revision,
    keys,
    cocosUuids,
    records,
  };
}

function parseAssetRecord(
  value: unknown,
  sourceId: string,
  revision: string,
  path: string,
): AssetRecord {
  const record = requireObject(value, path);
  requireExactKeys(
    record,
    [
      'resourceId',
      'cocosUuid',
      'runtimeTypeId',
      'primaryArtifact',
      'auxiliaryArtifactSets',
      'directDependencies',
      'decoderId',
    ],
    path,
  );
  const resourceId = requireNonEmptyString(
    record.resourceId,
    `${path}.resourceId`,
  );
  const cocosUuid = record.cocosUuid === undefined
    ? undefined
    : requireNonEmptyString(record.cocosUuid, `${path}.cocosUuid`);
  const auxiliaryValues = requireArray(
    record.auxiliaryArtifactSets,
    `${path}.auxiliaryArtifactSets`,
  );
  const auxiliaryArtifactSets = auxiliaryValues.map(
    (set, index) => parseAuxiliaryArtifactSet(
      set,
      sourceId,
      revision,
      `${path}.auxiliaryArtifactSets[${index}]`,
    ),
  );
  requireUniqueValues(
    auxiliaryArtifactSets.map((set) => set.slot),
    `${path}.auxiliaryArtifactSets slots`,
  );
  return {
    resourceId,
    cocosUuid,
    runtimeTypeId: requireNonEmptyString(
      record.runtimeTypeId,
      `${path}.runtimeTypeId`,
    ),
    primaryArtifact: parseArtifactLocation(
      record.primaryArtifact,
      sourceId,
      revision,
      `${path}.primaryArtifact`,
    ),
    auxiliaryArtifactSets,
    directDependencies: requireStringArray(
      record.directDependencies,
      `${path}.directDependencies`,
    ),
    revision,
    decoderId: requireNonEmptyString(record.decoderId, `${path}.decoderId`),
  };
}

function parseAuxiliaryArtifactSet(
  value: unknown,
  sourceId: string,
  revision: string,
  path: string,
): AuxiliaryArtifactSet {
  const set = requireObject(value, path);
  requireExactKeys(set, ['slot', 'candidates'], path);
  const candidateValues = requireArray(set.candidates, `${path}.candidates`);
  const candidates: ArtifactCandidate[] = candidateValues.map(
    (candidateValue, index) => {
      const candidatePath = `${path}.candidates[${index}]`;
      const candidate = requireObject(candidateValue, candidatePath);
      requireExactKeys(candidate, ['variant', 'location'], candidatePath);
      return {
        variant: candidate.variant === undefined
          ? undefined
          : requireNonEmptyString(
            candidate.variant,
            `${candidatePath}.variant`,
          ),
        location: parseArtifactLocation(
          candidate.location,
          sourceId,
          revision,
          `${candidatePath}.location`,
        ),
      };
    },
  );
  if (candidates.length === 0) {
    throw new TypeError(`${path}.candidates must not be empty.`);
  }
  requireUniqueValues(
    candidates.map((candidate) => candidate.variant ?? ''),
    `${path}.candidates variants`,
  );
  return {
    slot: requireNonEmptyString(set.slot, `${path}.slot`),
    candidates,
  };
}

function parseArtifactLocation(
  value: unknown,
  sourceId: string,
  revision: string,
  path: string,
): ArtifactLocation {
  const location = requireObject(value, path);
  requireExactKeys(
    location,
    [
      'key',
      'format',
      'byteSize',
      'entry',
      'preferredKind',
      'redirectBundleName',
    ],
    path,
  );
  const byteSize = location.byteSize === undefined
    ? undefined
    : requireNonNegativeInteger(location.byteSize, `${path}.byteSize`);
  const preferredKind = location.preferredKind === undefined
    ? undefined
    : requireArtifactKind(location.preferredKind, `${path}.preferredKind`);
  const redirectBundleName = location.redirectBundleName === undefined
    ? undefined
    : requireNonEmptyString(
      location.redirectBundleName,
      `${path}.redirectBundleName`,
    );
  return {
    sourceId,
    key: requireNonEmptyString(location.key, `${path}.key`),
    format: requireNonEmptyString(location.format, `${path}.format`),
    byteSize,
    revision,
    entry: location.entry === undefined
      ? undefined
      : parseArtifactEntry(location.entry, `${path}.entry`),
    preferredKind,
    redirectBundleName,
  };
}

function parseArtifactEntry(
  value: unknown,
  path: string,
): { readonly kind: ArtifactEntryKind; readonly index: number } {
  const entry = requireObject(value, path);
  requireExactKeys(entry, ['kind', 'index'], path);
  requireExactValue(entry.kind, ArtifactEntryKind.binPackV2, `${path}.kind`);
  return {
    kind: ArtifactEntryKind.binPackV2,
    index: requireNonNegativeInteger(entry.index, `${path}.index`),
  };
}

function requireArtifactKind(value: unknown, path: string): ArtifactKind {
  if (value === ArtifactKind.bytes || value === ArtifactKind.platformFile) {
    return value;
  }
  throw new TypeError(`${path} is not a supported Artifact kind.`);
}

function requireObject(
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${path} must be an array.`);
  }
  return value;
}

function requireStringArray(value: unknown, path: string): readonly string[] {
  const result = requireArray(value, path).map((entry, index) => (
    requireNonEmptyString(entry, `${path}[${index}]`)
  ));
  requireUniqueValues(result, path);
  return result;
}

function requireUniqueValues(
  values: readonly string[],
  path: string,
): void {
  if (new Set(values).size !== values.length) {
    throw new TypeError(`${path} must not contain duplicate values.`);
  }
}

function requireExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new TypeError(`${path} contains unknown field "${key}".`);
    }
  }
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${path} must be a non-empty string.`);
  }
  return value;
}

function requireNonNegativeInteger(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(`${path} must be a non-negative safe integer.`);
  }
  return value as number;
}

function requireExactValue(
  value: unknown,
  expected: string | number,
  path: string,
): void {
  if (value !== expected) {
    throw new TypeError(`${path} must equal ${JSON.stringify(expected)}.`);
  }
}

function addUnique<TKey, TValue>(
  map: Map<TKey, TValue>,
  key: TKey,
  value: TValue,
  label: string,
): void {
  if (map.has(key)) {
    throw new TypeError(`${label} "${String(key)}" is duplicated.`);
  }
  map.set(key, value);
}

function toHex(bytes: Uint8Array): string {
  let result = '';
  for (const byte of bytes) {
    result += byte.toString(16).padStart(2, '0');
  }
  return result;
}
