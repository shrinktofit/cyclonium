import { mergeContributions, type ExtensionContributions } from '@cyclonium/cc-extension-utils/extension';

import { assetHandlers } from './contributions/asset-db/asset-handlers.js';
import { createInspectorContribution } from './contributions/inspector/contribution.js';
import assetDBContributionScript from './contributions/asset-db/register.js?contribution-script';
import builderAssetCatalogContributionScript from './contributions/builder/asset-catalog.js?contribution-script';
import previewAssetCatalogContributionScript from './contributions/preview/asset-catalog.js?contribution-script';
import sceneContributionScript from './contributions/scene/contribution.js?contribution-script';
import serverAssetCatalogContributionScript from './contributions/server/asset-catalog.js?contribution-script';
import { toExtensionRelativeContributionPath } from './contribution-path.js';
import { logger } from './logger.js';
import { selfPackagePath } from './self-info.js';

export function register(info: {
  contributions: ExtensionContributions;
}): void {
  const contributions = createCycloContributions(selfPackagePath);
  mergeContributions(info.contributions ??= {}, contributions);
  logger.debug(`registered contributions: ${JSON.stringify(contributions, undefined, 2)}`);
}

export function createCycloContributions(packagePath: string): ExtensionContributions {
  const toExtensionRelativePath = (path: string): string => (
    toExtensionRelativeContributionPath(packagePath, path)
  );

  return {
    'asset-db': {
      'script': toExtensionRelativePath(assetDBContributionScript),
      'asset-handler': assetHandlers.map(({ register: handler, name, extnames }) => ({
        handler,
        name,
        extnames,
      })),
      'mount': {
        path: 'mount/assets',
      },
    },
    'inspector': createInspectorContribution(toExtensionRelativePath),
    'builder': toExtensionRelativePath(builderAssetCatalogContributionScript),
    'menu': [{
      path: 'i18n:menu.panel',
      label: 'Cyclo Asset Groups',
      message: 'openAssetGroups',
      group: 'cyclo-asset-pipeline',
    }],
    'messages': {
      openAssetGroups: {
        methods: ['openAssetGroups'],
      },
      getAssetGroupPanelState: {
        methods: ['getAssetGroupPanelState'],
      },
      createAssetPipelineSettings: {
        methods: ['createAssetPipelineSettings'],
      },
      createAssetGroup: {
        methods: ['createAssetGroup'],
      },
      updateAssetGroup: {
        methods: ['updateAssetGroup'],
      },
      deleteAssetGroup: {
        methods: ['deleteAssetGroup'],
      },
      moveAssetGroup: {
        methods: ['moveAssetGroup'],
      },
      inspectAssetGroup: {
        methods: ['inspectAssetGroup'],
      },
      createAssetGroupLabel: {
        methods: ['createAssetGroupLabel'],
      },
      deleteAssetGroupLabel: {
        methods: ['deleteAssetGroupLabel'],
      },
      addAssetGroupEntries: {
        methods: ['addAssetGroupEntries'],
      },
      updateAssetGroupEntry: {
        methods: ['updateAssetGroupEntry'],
      },
      deleteAssetGroupEntry: {
        methods: ['deleteAssetGroupEntry'],
      },
      moveAssetGroupEntry: {
        methods: ['moveAssetGroupEntry'],
      },
      selectCycloBuildTask: {
        methods: ['selectCycloBuildTask'],
      },
      queryCycloBuildTasks: {
        methods: ['queryCycloBuildTasks'],
      },
      buildCycloContent: {
        methods: ['buildCycloContent'],
      },
    },
    'preview': {
      'browser': {
        methods: toExtensionRelativePath(previewAssetCatalogContributionScript),
        hooks: {
          settings: 'injectBrowserAssetCatalog',
        },
      },
      'game-view': {
        methods: toExtensionRelativePath(previewAssetCatalogContributionScript),
        hooks: {
          settings: 'injectGameViewAssetCatalog',
        },
      },
    },
    'scene': {
      script: toExtensionRelativePath(sceneContributionScript),
    },
    'server': toExtensionRelativePath(serverAssetCatalogContributionScript),
  };
}
