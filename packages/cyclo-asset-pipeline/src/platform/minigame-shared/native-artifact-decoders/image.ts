import type { AbortSignal } from '@cyclonium/abort-controller';
import { invariant } from '@cyclonium/invariant';

import {
  ArtifactKind,
  type NativeBinding,
} from '../../../core/model.js';
import type {
  NativeArtifactDecodeContext,
  NativeArtifactDecoder,
} from '../../../runtime/cocos/native-artifact-decoder.js';
import type { MinigamePlatformAdapter } from '../minigame-platform-adapter.js';
import { requirePlatformFileArtifact } from './platform-file-artifact.js';

export class MinigameImageArtifactDecoder implements NativeArtifactDecoder {
  constructor(platform: MinigamePlatformAdapter) {
    this.#platform = platform;
  }

  readonly artifactKind = ArtifactKind.platformFile;
  readonly formats = ['png', 'jpeg', 'webp'] as const;

  async decode(
    context: NativeArtifactDecodeContext,
    signal: AbortSignal,
  ): Promise<NativeBinding> {
    const artifact = requirePlatformFileArtifact(context.artifact);
    const image = await this.#platform.createImage(artifact.path, signal);
    return new MinigameImageNativeBinding(image);
  }

  readonly #platform: MinigamePlatformAdapter;
}

class MinigameImageNativeBinding implements NativeBinding {
  constructor(value: object) {
    this.value = value;
  }

  readonly value: object;

  discard(): void {
    this.#complete();
  }

  release(): void {
    this.#complete();
  }

  #completed = false;

  #complete(): void {
    invariant(
      !this.#completed,
      'Mini-game image native binding was already completed.',
    );
    this.#completed = true;
  }
}
