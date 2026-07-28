import type {
  AssetPlatformService,
  CocosRuntimeAbi,
} from '../../runtime/cocos/index.js';
import {
  createMinigameAssetPlatformService,
  type HeaderStyleMinigameApi,
  requireMinigameGlobal,
} from '../minigame-shared/index.js';
import { BytedancePlatformAdapter } from './bytedance-platform-adapter.js';

export function createAssetPlatformService(
  runtimeAbi: CocosRuntimeAbi,
): AssetPlatformService {
  const api = requireMinigameGlobal('tt') as HeaderStyleMinigameApi;
  return createMinigameAssetPlatformService(
    new BytedancePlatformAdapter(api),
    undefined,
    runtimeAbi,
  );
}
