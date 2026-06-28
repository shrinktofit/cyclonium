import type { Dump } from '../../dump/dump.js';
import { logger } from '../../logger.js';
import { loadAsset, loadAssetUncached } from './asset.js';
import { applyDumpPatch, dumpEncode } from './dump.js';
import { serialize } from '../../infra/serialization/serialize.js';
import fs from 'fs-extra';

export const methods = {
  'dump-asset': async (uuid: string) => {
    const asset = await loadAssetUncached(uuid);
    const dumped = dumpEncode(asset);
    return dumped;
  },
  'apply-dump': async (uuid: string, dump: Dump, path: string) => {
    const asset = await loadAsset(uuid);
    applyDumpPatch(asset, dump, path);
  },
  'save-asset': async (uuid: string) => {
    const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', uuid);
    if (!assetInfo) {
      logger.error(`Failed to query asset ${uuid} info`);
      return;
    }
    const assetFile = assetInfo.file;
    const asset = await loadAsset(uuid);
    const serialized = serialize(asset);
    await fs.writeFile(assetFile, serialized);
    await Editor.Message.request('asset-db', 'refresh-asset', uuid);
  },
};
