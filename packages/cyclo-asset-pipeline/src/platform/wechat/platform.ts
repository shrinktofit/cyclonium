import type {
  AssetPlatformService,
  CocosRuntimeAbi,
} from '../../runtime/cocos/index.js';
import {
  createMinigameAssetPlatformService,
  requireMinigameGlobal,
} from '../minigame-shared/index.js';
import {
  WechatPlatformAdapter,
  type WechatMinigameApi,
} from './wechat-platform-adapter.js';

export function createAssetPlatformService(
  runtimeAbi: CocosRuntimeAbi,
): AssetPlatformService {
  const api = requireMinigameGlobal('wx') as WechatMinigameApi;
  return createMinigameAssetPlatformService(
    new WechatPlatformAdapter(api),
    undefined,
    runtimeAbi,
  );
}
