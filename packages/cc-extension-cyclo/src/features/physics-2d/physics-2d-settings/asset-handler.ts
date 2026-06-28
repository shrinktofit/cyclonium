// @ts-expect-error
import { Asset, Importer, VirtualAsset } from '@editor/asset-db';
import YAML from 'yaml';
import { outputFile, readFile } from 'fs-extra';
import { logger } from '../../../logger.js';
import { defineAssetHandler } from '../../../contributions/asset-db/helper.js';
import { resolve } from 'node:path';
import { selfPackagePath } from '../../../self-info.js';

export default defineAssetHandler({
  name: 'cyclo-physics-2d-settings',

  assetType: 'cyclo.Physics2DSettings',

  iconInfo: {
    default: {
      type: 'image',
      value: resolve(selfPackagePath, 'public', 'icons', 'physics-2d-settings.png'),
    },
  },

  createInfo: {
    generateMenuInfo() {
      return [
        {
          label: `Cyclo Physics 2D Settings`,
          fullFileName: 'Default.cyclo-px2-settings',
          // template: 'db://test.shadergraph',
        },
      ];
    },

    async create(options: {
      target: string;
      template: string;
    }): Promise<string | null> {
      logger.debug(`CycloPhysics2DSettingsHandler.create ${JSON.stringify(options.target, undefined, 2)}`);
      await outputFile(options.target, await getDefaultPhysics2DSettingsFileContent());
      return options.target;
    },
  },

  async open(_asset: Asset): Promise<boolean> {
    return false;
  },

  importer: {
    version: '0.0.1',

    migrations: [],

    async before(_asset: Asset) {
      logger.debug(`[CycloPhysics2DSettingsHandler] before`);
      return true;
    },

    async after(_asset: Asset) {
      logger.debug(`[CycloPhysics2DSettingsHandler] after`);
      return true;
    },

    async import(asset: Asset | VirtualAsset) {
      logger.debug(`[CycloPhysics2DSettingsHandler] import`);
      if (!(asset instanceof Asset)) {
        throw new Error('asset must be instance of Asset');
      }
      const fileContent = await readFile(asset.source, 'utf-8');
      const fileContentParsed = YAML.parse(fileContent);
      const cc = await import('cc');
      const Physics2DSettings = cc.js.getClassByName('cyclo.Physics2DSettings') as typeof import('@cyclonium/physics-2d').Physics2DSettings | undefined;
      if (!Physics2DSettings) {
        throw new Error('Physics2DSettings not found');
      }
      const deserialized = cc.deserialize(fileContentParsed);
      if (!(deserialized instanceof Physics2DSettings)) {
        throw new Error('deserialized must be instance of Physics2DSettings');
      }
      // @ts-expect-error
      const serialized = EditorExtends.serialize(deserialized);
      await asset.saveToLibrary('.json', serialized);
      return true;
    },
  },
});

async function getDefaultPhysics2DSettingsFileContent() {
  const cc = await import('cc');
  const Physics2DSettings = cc.js.getClassByName('cyclo.Physics2DSettings') as typeof import('@cyclonium/physics-2d').Physics2DSettings | undefined;
  if (!Physics2DSettings) {
    throw new Error('Physics2DSettings not found');
  }
  const defaultPhysics2DSettings = new Physics2DSettings();
  // @ts-expect-error
  const serialized = EditorExtends.serialize(defaultPhysics2DSettings);
  return YAML.stringify(JSON.parse(serialized));
}
