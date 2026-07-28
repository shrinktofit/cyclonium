import {
  ALIPAY,
  BYTEDANCE,
  HTML5,
  WECHAT,
} from 'cc/env';
import { settings } from 'cc';

import { acquireAssetCatalog } from './catalog-document.js';
import type { AssetRuntimeConfiguration } from './core/contracts.js';
import type {
  AssetCatalog,
} from './core/model.js';
import type {
  AssetPipelineInstallOptions,
} from './core/public.js';
import {
  AssetIntegrityPolicy,
  AssetPipelineInstallError,
  AssetPipelineInstallStage,
} from './core/public.js';
import { createAssetPlatformService as createAlipayAssetPlatformService } from './platform/alipay/index.js';
import { createAssetPlatformService as createBytedanceAssetPlatformService } from './platform/bytedance/index.js';
import { createAssetPlatformService as createWebAssetPlatformService } from './platform/web/index.js';
import { createAssetPlatformService as createWechatAssetPlatformService } from './platform/wechat/index.js';
import {
  type AssetPlatformService,
  CocosAssetFinalizer,
  COCOS_IMPORT_DECODER_ID,
  createNativeArtifactDecoderRegistry,
  CocosImportDecoder,
  CocosRuntimeAbi,
  createRemoteAssetLoader,
} from './runtime/cocos/index.js';

export async function createDefaultRuntimeConfiguration(
  options: AssetPipelineInstallOptions,
): Promise<AssetRuntimeConfiguration> {
  const runtimeAbi = new CocosRuntimeAbi();
  const platform = createAssetPlatformService(runtimeAbi);
  let pointer: unknown;
  try {
    pointer = settings.querySettings<unknown>('cyclo', 'assetCatalog');
  } catch (error) {
    throw new AssetPipelineInstallError(
      AssetPipelineInstallStage.settings,
      'Could not query Cyclo Asset Catalog settings.',
      { cause: error },
    );
  }
  const catalog = await acquireAssetCatalog(
    pointer,
    platform.artifactSource,
    platform.sha256,
  );
  return createRuntimeConfigurationForPlatform(
    options,
    catalog,
    runtimeAbi,
    platform,
  );
}

export function createRuntimeConfiguration(
  options: AssetPipelineInstallOptions,
  catalog: AssetCatalog,
): AssetRuntimeConfiguration {
  const runtimeAbi = new CocosRuntimeAbi();
  const platform = createAssetPlatformService(runtimeAbi);
  return createRuntimeConfigurationForPlatform(
    options,
    catalog,
    runtimeAbi,
    platform,
  );
}

function createRuntimeConfigurationForPlatform(
  options: AssetPipelineInstallOptions,
  catalog: AssetCatalog,
  runtimeAbi: CocosRuntimeAbi,
  platform: AssetPlatformService,
): AssetRuntimeConfiguration {
  const nativeArtifactDecoders = createNativeArtifactDecoderRegistry(
    platform.nativeArtifactDecoders,
  );
  const decoder = new CocosImportDecoder(
    runtimeAbi,
    nativeArtifactDecoders,
  );
  return {
    catalog,
    sources: [platform.artifactSource],
    decoders: [decoder],
    finalizer: new CocosAssetFinalizer(),
    remoteAssetLoader: createRemoteAssetLoader(
      platform.artifactSource.id,
      nativeArtifactDecoders,
    ),
    sha256: platform.sha256,
    integrityPolicy: options.integrityPolicy
      ?? AssetIntegrityPolicy.whenPresent,
    onIntegrityDiagnostic: options.onIntegrityDiagnostic,
    artifactCacheByteBudget: options.artifactCacheByteBudget ?? 0,
    runtimeVariant: platform.runtimeVariant,
  };
}

function createAssetPlatformService(
  runtimeAbi: CocosRuntimeAbi,
): AssetPlatformService {
  if (HTML5) {
    return createWebAssetPlatformService(runtimeAbi);
  }
  if (WECHAT) {
    return createWechatAssetPlatformService(runtimeAbi);
  }
  if (ALIPAY) {
    return createAlipayAssetPlatformService(runtimeAbi);
  }
  if (BYTEDANCE) {
    return createBytedanceAssetPlatformService(runtimeAbi);
  }
  throw new Error(
    'Cyclo Asset Pipeline supports HTML5, WeChat, Alipay, and ByteDance.',
  );
}

export { COCOS_IMPORT_DECODER_ID };
