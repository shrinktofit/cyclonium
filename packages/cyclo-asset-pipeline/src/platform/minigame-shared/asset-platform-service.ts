import {
  type AssetPlatformService,
  CocosRuntimeAbi,
} from '../../runtime/cocos/index.js';
import { sha256 } from '../../sha256/index.js';
import { MinigameArtifactSource } from './minigame-artifact-source.js';
import type { MinigamePlatformAdapter } from './minigame-platform-adapter.js';
import { MinigameAudioArtifactDecoder } from './native-artifact-decoders/audio.js';
import { MinigameFontArtifactDecoder } from './native-artifact-decoders/font.js';
import { MinigameImageArtifactDecoder } from './native-artifact-decoders/image.js';

export function createMinigameAssetPlatformService(
  platform: MinigamePlatformAdapter,
  artifactSource = new MinigameArtifactSource(platform),
  runtimeAbi = new CocosRuntimeAbi(),
): AssetPlatformService {
  return {
    runtimeVariant: platform.id,
    artifactSource,
    nativeArtifactDecoders: [
      new MinigameImageArtifactDecoder(platform),
      new MinigameFontArtifactDecoder(platform),
      new MinigameAudioArtifactDecoder(runtimeAbi),
    ],
    sha256,
  };
}

export function requireMinigameGlobal(name: string): object {
  const value = Reflect.get(globalThis, name) as unknown;
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Mini-game global "${name}" is unavailable.`);
  }
  return value;
}
