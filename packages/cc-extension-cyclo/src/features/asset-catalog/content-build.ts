import { join } from 'node:path';
import { outputFile } from 'fs-extra';

import {
  loadAssetPipelineAuthoringData,
} from '../asset-groups/authoring/index.js';
import { BundleConfigArtifactIndex } from './bundle-config-artifact-index.js';
import { readBuiltBundleConfigs } from './bundle-config-reader.js';
import {
  compileAssetCatalog,
  createCatalogPointer,
} from './catalog-compiler.js';
import {
  CocosBuilderAbi,
  type CocosBuildTask,
} from './cocos-builder-abi.js';
import { PreviewArtifactIndex } from './preview-artifact-index.js';
import { synchronizeTechnicalBundleAnchors } from './technical-bundle-anchors.js';
import {
  createTechnicalBundleOptions,
  getUnmanagedBundleOptions,
  technicalBundleName,
} from './technical-bundles.js';

export interface CycloContentBuildResult {
  readonly outputDirectory: string;
  readonly catalogFile: string;
  readonly pointerFile: string;
  readonly revision: string;
}

export async function queryCycloContentBuildTasks(): Promise<readonly CocosBuildTask[]> {
  return new CocosBuilderAbi().queryBuildTasks();
}

export async function buildCycloContent(
  buildTaskId: string,
): Promise<CycloContentBuildResult> {
  const abi = new CocosBuilderAbi();
  const tasks = await abi.queryBuildTasks();
  const task = tasks.find((candidate) => candidate.id === buildTaskId);
  if (task === undefined) {
    throw new Error(`Cocos Build Task "${buildTaskId}" does not exist.`);
  }
  const authoring = await loadAssetPipelineAuthoringData(Editor.Project.path);
  const configuredBundles = await abi.queryProjectBundleOptions(task.options.platform);
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
  const relativeOutputDirectory = `build/cyclo-content/${buildTaskId}`;
  const outputDirectory = join(Editor.Project.path, relativeOutputDirectory);
  await abi.buildBundles({
    buildTaskId,
    destination: `project://${relativeOutputDirectory}`,
    bundleConfigs: technicalBundles,
  });

  const platformOutputDirectory = join(outputDirectory, task.options.outputName);
  const expectedBundleNames = authoring.groups
    .filter((group) => group.includeInBuild)
    .map((group) => technicalBundleName(group.id));
  const bundleSources = await readBuiltBundleConfigs(
    platformOutputDirectory,
    expectedBundleNames,
  );
  const artifactIndex = await BundleConfigArtifactIndex.create(
    abi,
    bundleSources,
    outputDirectory,
    task.options.platform,
  );
  const catalog = await compileAssetCatalog(authoring, artifactIndex);
  const catalogFileName = `catalog.${catalog.revision}.json`;
  const catalogFile = join(outputDirectory, catalogFileName);
  const pointerFile = join(outputDirectory, 'catalog-pointer.json');
  await outputFile(catalogFile, catalog.bytes);
  await outputFile(
    pointerFile,
    JSON.stringify(createCatalogPointer(catalog, catalogFileName)),
  );
  return {
    outputDirectory,
    catalogFile,
    pointerFile,
    revision: catalog.revision,
  };
}
