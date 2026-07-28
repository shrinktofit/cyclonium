import { join } from 'node:path';
import { emptyDir, outputFile, pathExists } from 'fs-extra';

import {
  getAssetPipelineAuthoringPaths,
  loadAssetPipelineAuthoringData,
} from '../../features/asset-groups/authoring/index.js';
import {
  compileAssetCatalog,
  createCatalogPointer,
} from '../../features/asset-catalog/catalog-compiler.js';
import { CocosBuilderAbi } from '../../features/asset-catalog/cocos-builder-abi.js';
import { PreviewArtifactIndex } from '../../features/asset-catalog/preview-artifact-index.js';

export const PREVIEW_CATALOG_DIRECTORY = join(
  Editor.Project.tmpDir,
  'cyclo-asset-pipeline',
  'catalog',
);

export async function injectBrowserAssetCatalog(
  settings: Record<string, unknown>,
): Promise<void> {
  await injectPreviewAssetCatalog(settings);
}

export async function injectGameViewAssetCatalog(
  settings: Record<string, unknown>,
): Promise<void> {
  await injectPreviewAssetCatalog(settings);
}

export async function unload(): Promise<void> {
  await emptyDir(PREVIEW_CATALOG_DIRECTORY);
}

async function injectPreviewAssetCatalog(
  settings: Record<string, unknown>,
): Promise<void> {
  const authoringPaths = getAssetPipelineAuthoringPaths(Editor.Project.path);
  if (!await pathExists(authoringPaths.settingsFile)) {
    return;
  }
  const abi = new CocosBuilderAbi();
  const authoring = await loadAssetPipelineAuthoringData(Editor.Project.path);
  const artifactIndex = new PreviewArtifactIndex(abi);
  const catalog = await compileAssetCatalog(authoring, artifactIndex);
  const fileName = `catalog.${catalog.revision}.json`;
  await outputFile(join(PREVIEW_CATALOG_DIRECTORY, fileName), catalog.bytes);
  const cyclo = readOrCreateSettingsObject(settings, 'cyclo');
  cyclo.assetCatalog = createCatalogPointer(
    catalog,
    `/cyclo-asset-pipeline/catalog/${fileName}`,
  );
}

function readOrCreateSettingsObject(
  settings: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const current = settings[key];
  if (current === undefined) {
    const value: Record<string, unknown> = {};
    settings[key] = value;
    return value;
  }
  if (typeof current !== 'object' || current === null || Array.isArray(current)) {
    throw new Error(`Cocos preview settings.${key} is not an object.`);
  }
  return current as Record<string, unknown>;
}
