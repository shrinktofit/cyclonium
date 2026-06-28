import { Asset, assetManager } from 'cc';
import { promisify } from 'node:util';

export async function loadAsset<TAsset extends Asset = Asset>(uuid: string, type?: new () => TAsset) {
  const asset = await promisify(assetManager.loadAny)(uuid);
  if (type && !(asset instanceof type)) {
    throw new Error(`Expect asset ${uuid} to be of type ${type}`);
  }
  return asset as TAsset;
}

export async function loadAssetUncached<TAsset extends Asset = Asset>(uuid: string, type?: new () => TAsset) {
  const cached = assetManager.assets.get(uuid);
  if (cached) {
    assetManager.releaseAsset(cached);
  }
  const asset = await loadAsset(uuid, type);
  return asset;
}
