import { join } from 'node:path';
import { outputFile, pathExists } from 'fs-extra';

import type {
  IBuildResult,
  IBuildTaskOption,
} from '@cocos/creator-types/editor/packages/builder/@types/public';

import {
  getAssetPipelineAuthoringPaths,
  loadAssetPipelineAuthoringData,
  type AssetPipelineAuthoringData,
} from '../../features/asset-groups/authoring/index.js';
import { BuildResultArtifactIndex } from '../../features/asset-catalog/build-result-artifact-index.js';
import {
  compileAssetCatalog,
  createCatalogPointer,
} from '../../features/asset-catalog/catalog-compiler.js';
import { CocosBuilderAbi } from '../../features/asset-catalog/cocos-builder-abi.js';
import { PreviewArtifactIndex } from '../../features/asset-catalog/preview-artifact-index.js';
import { synchronizeTechnicalBundleAnchors } from '../../features/asset-catalog/technical-bundle-anchors.js';
import {
  createTechnicalBundleOptions,
  getUnmanagedBundleOptions,
} from '../../features/asset-catalog/technical-bundles.js';

interface ActiveBuild {
  readonly authoring: AssetPipelineAuthoringData;
}

const activeBuilds = new WeakMap<IBuildResult, ActiveBuild>();

// Vortex loads the contribution once in the Builder host, then loads the
// configured hooks module in each build worker. This file intentionally serves
// both roles so the emitted, content-hashed contribution filename stays exact.
export const configs = {
  '*': {
    hooks: __filename,
  },
};

export const throwError = true;
export const title = 'Cyclo Asset Catalog';

export async function onBeforeBuild(
  options: IBuildTaskOption,
  result: IBuildResult,
): Promise<void> {
  const authoringPaths = getAssetPipelineAuthoringPaths(Editor.Project.path);
  if (!await pathExists(authoringPaths.settingsFile)) {
    return;
  }
  const abi = new CocosBuilderAbi();
  const authoring = await loadAssetPipelineAuthoringData(Editor.Project.path);
  const configuredBundles = options.bundleConfigs?.length
    ? [...options.bundleConfigs]
    : [...await abi.queryProjectBundleOptions(options.platform)];
  const existingBundles = getUnmanagedBundleOptions(authoring, configuredBundles);
  const metadataIndex = new PreviewArtifactIndex(abi);
  const anchorUuids = await synchronizeTechnicalBundleAnchors(
    Editor.Project.path,
    authoring,
    metadataIndex,
    abi,
  );
  const technicalBundles = createTechnicalBundleOptions(
    authoring,
    anchorUuids,
    existingBundles,
  );
  await abi.configureTechnicalBundles(technicalBundles);
  activeBuilds.set(result, { authoring });
}

export async function onBeforeCompressSettings(
  options: IBuildTaskOption,
  result: IBuildResult,
): Promise<void> {
  const activeBuild = activeBuilds.get(result);
  if (activeBuild === undefined) {
    return;
  }
  if (result.settings === undefined) {
    throw new Error('Cocos IBuildResult.settings is unavailable before settings compression.');
  }
  const abi = new CocosBuilderAbi();
  const artifactIndex = new BuildResultArtifactIndex(abi, result, options.platform);
  const catalog = await compileAssetCatalog(activeBuild.authoring, artifactIndex);
  const fileName = `catalog.${catalog.revision}.json`;
  const catalogDirectory = join(result.paths.assets, 'cyclo');
  await outputFile(join(catalogDirectory, fileName), catalog.bytes);

  const settings = result.settings as unknown as Record<string, unknown>;
  const cyclo = readOrCreateSettingsObject(settings, 'cyclo');
  cyclo.assetCatalog = createCatalogPointer(
    catalog,
    `assets/cyclo/${fileName}`,
  );
  activeBuilds.delete(result);
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
    throw new Error(`Cocos settings.${key} is not an object.`);
  }
  return current as Record<string, unknown>;
}
