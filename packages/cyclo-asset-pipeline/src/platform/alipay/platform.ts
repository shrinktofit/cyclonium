import type {
  AssetPlatformService,
  CocosRuntimeAbi,
} from '../../runtime/cocos/index.js';
import {
  createMinigameAssetPlatformService,
  requireMinigameGlobal,
} from '../minigame-shared/index.js';
import {
  AlipayPlatformAdapter,
  type AlipayMinigameApi,
} from './alipay-platform-adapter.js';

export function createAssetPlatformService(
  runtimeAbi: CocosRuntimeAbi,
): AssetPlatformService {
  const api = requireMinigameGlobal('my') as AlipayMinigameApi;
  return createMinigameAssetPlatformService(
    new AlipayPlatformAdapter(api),
    undefined,
    runtimeAbi,
  );
}
