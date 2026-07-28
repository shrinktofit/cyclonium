import {
  type AssetPlatformService,
  CocosRuntimeAbi,
} from '../../runtime/cocos/index.js';
import { WebArtifactSource } from './web-artifact-source.js';
import { WebAudioArtifactDecoder } from './native-artifact-decoders/audio.js';
import { WebFontArtifactDecoder } from './native-artifact-decoders/font.js';
import { WebImageArtifactDecoder } from './native-artifact-decoders/image.js';
import { sha256 } from './web-sha256.js';

export function createAssetPlatformService(
  runtimeAbi: CocosRuntimeAbi,
): AssetPlatformService {
  return createWebAssetPlatformService(new WebArtifactSource(), runtimeAbi);
}

export function createWebAssetPlatformService(
  artifactSource = new WebArtifactSource(),
  runtimeAbi = new CocosRuntimeAbi(),
): AssetPlatformService {
  return {
    runtimeVariant: 'web',
    artifactSource,
    nativeArtifactDecoders: [
      new WebImageArtifactDecoder(),
      new WebFontArtifactDecoder(),
      new WebAudioArtifactDecoder(runtimeAbi),
    ],
    sha256,
  };
}
