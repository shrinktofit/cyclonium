import { readFile } from 'node:fs/promises';

import {
  AssetDbAuthoringAssetPersistence,
  type AuthoringAssetPersistence,
} from '../asset-groups/authoring-persistence.js';
import {
  assetGroupAnchorAssetDbUrl,
  assetGroupAnchorFile,
  ensureAssetGroupAnchor,
  serializeAssetGroupAnchor,
  type AssetGroupAnchorReference,
} from '../asset-groups/bundle-anchor.js';
import {
  getAssetGroupStorageName,
  getAssetPipelineAuthoringPaths,
  type AssetPipelineAuthoringData,
} from '../asset-groups/authoring/index.js';
import type { CatalogArtifactIndex } from './artifact-index.js';
import {
  CatalogCompileError,
  expandCatalogEntries,
} from './catalog-compiler.js';
import type { CocosBuilderAbi } from './cocos-builder-abi.js';

export async function synchronizeTechnicalBundleAnchors(
  projectPath: string,
  authoring: AssetPipelineAuthoringData,
  artifactIndex: CatalogArtifactIndex,
  abi: Pick<CocosBuilderAbi, 'queryAsset'>,
  persistence: AuthoringAssetPersistence = new AssetDbAuthoringAssetPersistence(),
): Promise<ReadonlyMap<string, string>> {
  const paths = getAssetPipelineAuthoringPaths(projectPath);
  const expandedEntries = await expandCatalogEntries(authoring, artifactIndex);
  const referencesByGroup = new Map<string, AssetGroupAnchorReference[]>();
  for (const entry of expandedEntries) {
    const references = referencesByGroup.get(entry.group.id) ?? [];
    references.push({
      uuid: entry.assetUuid,
      expectedType: entry.runtimeTypeId,
    });
    referencesByGroup.set(entry.group.id, references);
  }

  const anchorUuids = new Map<string, string>();
  for (const group of authoring.groups) {
    if (!group.includeInBuild) {
      continue;
    }
    const storageName = getAssetGroupStorageName(group.name);
    await ensureAssetGroupAnchor(paths, storageName, persistence);
    const file = assetGroupAnchorFile(paths, storageName);
    const assetDbUrl = assetGroupAnchorAssetDbUrl(paths, storageName);
    const expectedSource = serializeAssetGroupAnchor(referencesByGroup.get(group.id) ?? []);
    if (await readFile(file, 'utf8') !== expectedSource) {
      await persistence.save(file, assetDbUrl, expectedSource);
    }
    const info = await abi.queryAsset(assetDbUrl);
    if (info === undefined || info.isDirectory) {
      throw new CatalogCompileError(
        `Cocos AssetDB did not import the technical Bundle Anchor for Group "${group.name}".`,
      );
    }
    anchorUuids.set(group.id, info.uuid);
  }
  return anchorUuids;
}
