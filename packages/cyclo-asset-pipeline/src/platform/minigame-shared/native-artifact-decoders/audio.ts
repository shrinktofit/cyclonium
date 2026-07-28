import type { AbortSignal } from '@cyclonium/abort-controller';
import { invariant } from '@cyclonium/invariant';

import type { ArtifactLease } from '../../../core/artifact-lifetime.js';
import {
  ArtifactKind,
  type NativeBinding,
} from '../../../core/model.js';
import type {
  CocosAudioMeta,
  CocosRuntimeAbi,
} from '../../../runtime/cocos/cocos-runtime-abi.js';
import {
  type NativeArtifactDecodeContext,
  type NativeArtifactDecoder,
  throwIfAborted,
} from '../../../runtime/cocos/native-artifact-decoder.js';
import { requirePlatformFileArtifact } from './platform-file-artifact.js';

export class MinigameAudioArtifactDecoder implements NativeArtifactDecoder {
  constructor(runtimeAbi: CocosRuntimeAbi) {
    this.#runtimeAbi = runtimeAbi;
  }

  readonly artifactKind = ArtifactKind.platformFile;
  readonly formats = ['mp3'] as const;

  async decode(
    context: NativeArtifactDecodeContext,
    signal: AbortSignal,
  ): Promise<NativeBinding> {
    throwIfAborted(signal);
    const artifact = requirePlatformFileArtifact(context.artifact);
    const lease = artifact.lease.retain();
    try {
      const value = await this.#runtimeAbi.loadAudio(
        artifact.path,
        context.nativeDependency,
      );
      if (signal.aborted) {
        value.player.destroy();
        throwIfAborted(signal);
      }
      return new MinigameAudioNativeBinding(value, lease);
    } catch (error) {
      lease.release();
      throw error;
    }
  }

  readonly #runtimeAbi: CocosRuntimeAbi;
}

class MinigameAudioNativeBinding implements NativeBinding {
  constructor(value: CocosAudioMeta, lease: ArtifactLease) {
    this.value = value;
    this.#lease = lease;
  }

  readonly value: CocosAudioMeta;

  discard(): void {
    this.#complete();
    this.value.player.destroy();
  }

  release(): void {
    this.#complete();
  }

  readonly #lease: ArtifactLease;
  #completed = false;

  #complete(): void {
    invariant(
      !this.#completed,
      'Mini-game audio native binding was already completed.',
    );
    this.#completed = true;
    this.#lease.release();
  }
}
