import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureDir } from 'fs-extra';

import type { AuthoringAssetPersistence } from './authoring-persistence.js';
import type { AssetPipelineAuthoringPaths } from './authoring-store.js';
import {
  ASSET_GROUP_ANCHOR_CLASS_NAME,
  serializeUniversalAsset,
  type UniversalAssetDocument,
} from './universal-asset-serialization.js';

export const ASSET_GROUP_ANCHOR_FILE_NAME = 'Anchor.asset';

export interface AssetGroupAnchorReference {
  readonly uuid: string;
  readonly expectedType: string;
}

interface AssetGroupAnchorDocument extends UniversalAssetDocument {
  readonly __type__: typeof ASSET_GROUP_ANCHOR_CLASS_NAME;
  readonly rootAssets: readonly SerializedAssetReference[];
}

interface SerializedAssetReference {
  readonly __uuid__: string;
  readonly __expectedType__: string;
}

export function assetGroupAnchorFile(
  paths: AssetPipelineAuthoringPaths,
  groupStorageName: string,
): string {
  return join(assetGroupBundleRootPath(paths, groupStorageName), ASSET_GROUP_ANCHOR_FILE_NAME);
}

export function assetGroupAnchorAssetDbUrl(
  paths: AssetPipelineAuthoringPaths,
  groupStorageName: string,
): string {
  return `${assetGroupBundleRootAssetDbUrl(paths, groupStorageName)}/${ASSET_GROUP_ANCHOR_FILE_NAME}`;
}

export function assetGroupBundleRootPath(
  paths: AssetPipelineAuthoringPaths,
  groupStorageName: string,
): string {
  return join(paths.bundleRootsDirectory, groupStorageName);
}

export function assetGroupBundleRootAssetDbUrl(
  paths: AssetPipelineAuthoringPaths,
  groupStorageName: string,
): string {
  return `${paths.bundleRootsAssetDbUrl}/${groupStorageName}`;
}

export function serializeAssetGroupAnchor(
  references: readonly AssetGroupAnchorReference[],
): string {
  const seen = new Set<string>();
  const rootAssets: SerializedAssetReference[] = [];
  for (const reference of references) {
    if (seen.has(reference.uuid)) {
      continue;
    }
    seen.add(reference.uuid);
    rootAssets.push({
      __uuid__: reference.uuid,
      __expectedType__: reference.expectedType,
    });
  }
  const document: AssetGroupAnchorDocument = {
    __type__: ASSET_GROUP_ANCHOR_CLASS_NAME,
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    _native: '',
    rootAssets,
  };
  return serializeUniversalAsset(document);
}

export async function ensureAssetGroupAnchor(
  paths: AssetPipelineAuthoringPaths,
  groupStorageName: string,
  persistence: AuthoringAssetPersistence,
): Promise<void> {
  const root = assetGroupBundleRootPath(paths, groupStorageName);
  const file = assetGroupAnchorFile(paths, groupStorageName);
  await ensureDir(root);
  if (await fileExists(file)) {
    return;
  }
  await persistence.create(
    file,
    assetGroupAnchorAssetDbUrl(paths, groupStorageName),
    serializeAssetGroupAnchor([]),
  );
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
