import type { IBundleOptions } from '@cocos/creator-types/editor/packages/builder/@types/public';

import {
  getAssetGroupStorageName,
  type AssetPipelineAuthoringData,
} from '../asset-groups/authoring/index.js';
import { CatalogCompileError } from './catalog-compiler.js';

// Vortex/Creator 3.8.7 assigns 20 to start-scene and 21 to internal.
const COCOS_BUILTIN_MAX_BUNDLE_PRIORITY = 21;

export function createTechnicalBundleOptions(
  authoring: AssetPipelineAuthoringData,
  anchorUuids: ReadonlyMap<string, string>,
  existingBundles: readonly IBundleOptions[],
): readonly IBundleOptions[] {
  const existingNames = new Set(existingBundles.map((bundle) => bundle.name));
  const priority = Math.max(
    COCOS_BUILTIN_MAX_BUNDLE_PRIORITY,
    ...existingBundles.map((bundle) => bundle.priority ?? 0),
  ) + 1;
  return authoring.groups
    .filter((group) => group.includeInBuild)
    .map((group): IBundleOptions => {
      const name = technicalBundleName(group.id);
      if (existingNames.has(name)) {
        throw new CatalogCompileError(
          `Cocos Bundle name "${name}" conflicts with Cyclo Asset Group "${group.name}".`,
        );
      }
      const anchorUuid = anchorUuids.get(group.id);
      if (anchorUuid === undefined) {
        throw new CatalogCompileError(
          `Cyclo Asset Group "${group.name}" has no imported technical Bundle Anchor.`,
        );
      }
      return {
        root: `db://assets/CycloAssetData/BundleRoots/${getAssetGroupStorageName(group.name)}`,
        name,
        output: true,
        priority,
        compressionType: 'none',
        isRemote: false,
        bundleFilterConfig: [{
          range: 'include',
          type: 'asset',
          assets: [anchorUuid],
        }],
      };
    });
}

export function technicalBundleName(groupId: string): string {
  return `cyclo-${groupId}`;
}

export function getUnmanagedBundleOptions(
  authoring: AssetPipelineAuthoringData,
  bundles: readonly IBundleOptions[],
): readonly IBundleOptions[] {
  const managedBundleRoots = new Map(authoring.groups.map((group) => [
    technicalBundleName(group.id),
    `db://assets/CycloAssetData/BundleRoots/${getAssetGroupStorageName(group.name)}`,
  ]));
  return bundles.filter((bundle) => managedBundleRoots.get(bundle.name) !== bundle.root);
}
