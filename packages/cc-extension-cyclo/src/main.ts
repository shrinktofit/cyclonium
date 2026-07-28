import { assetCatalogExtensionMethods } from './features/asset-catalog/content-build-methods.js';
import { assetGroupsAuthoringMethods } from './features/asset-groups/authoring-methods.js';
import { logger } from './logger.js';
import {
  selfExtensionName,
  selfPackageName,
} from './self-info.js';

export const methods = {
  ...assetCatalogExtensionMethods,
  ...assetGroupsAuthoringMethods,

  openAssetGroups(): Promise<boolean> {
    return Editor.Panel.open(`${selfPackageName}.asset-groups`);
  },
};

export function load(): void {
  logger.debug(`${selfExtensionName} loaded`);
}

export function unload() {
  logger.debug(`${selfExtensionName} unloaded`);
}
