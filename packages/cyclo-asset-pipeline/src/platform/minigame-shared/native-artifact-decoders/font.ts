import type { AbortSignal } from '@cyclonium/abort-controller';
import { invariant } from '@cyclonium/invariant';

import type { ArtifactLease } from '../../../core/artifact-lifetime.js';
import {
  ArtifactKind,
  type NativeBinding,
} from '../../../core/model.js';
import {
  type NativeArtifactDecodeContext,
  type NativeArtifactDecoder,
  throwIfAborted,
} from '../../../runtime/cocos/native-artifact-decoder.js';
import type { MinigamePlatformAdapter } from '../minigame-platform-adapter.js';
import { requirePlatformFileArtifact } from './platform-file-artifact.js';

export class MinigameFontArtifactDecoder implements NativeArtifactDecoder {
  constructor(platform: MinigamePlatformAdapter) {
    this.#platform = platform;
  }

  readonly artifactKind = ArtifactKind.platformFile;
  readonly formats = ['ttf'] as const;

  decode(
    context: NativeArtifactDecodeContext,
    signal: AbortSignal,
  ): Promise<NativeBinding> {
    throwIfAborted(signal);
    const artifact = requirePlatformFileArtifact(context.artifact);
    const lease = artifact.lease.retain();
    try {
      const family = this.#platform.loadFont(artifact.path);
      if (family.length === 0) {
        throw new Error(
          `Mini-game font loading returned no family for "${artifact.path}".`,
        );
      }
      throwIfAborted(signal);
      return Promise.resolve(new MinigameFontNativeBinding(family, lease));
    } catch (error) {
      lease.release();
      throw error;
    }
  }

  readonly #platform: MinigamePlatformAdapter;
}

class MinigameFontNativeBinding implements NativeBinding {
  constructor(value: string, lease: ArtifactLease) {
    this.value = value;
    this.#lease = lease;
  }

  readonly value: string;

  discard(): void {
    this.#complete();
  }

  release(): void {
    this.#complete();
  }

  readonly #lease: ArtifactLease;
  #completed = false;

  #complete(): void {
    invariant(
      !this.#completed,
      'Mini-game font native binding was already completed.',
    );
    this.#completed = true;
    this.#lease.release();
  }
}
