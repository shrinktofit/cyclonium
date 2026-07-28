import type { AbortSignal } from '@cyclonium/abort-controller';
import { invariant } from '@cyclonium/invariant';

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
  requireByteArtifact,
  throwIfAborted,
} from '../../../runtime/cocos/native-artifact-decoder.js';
import { blobPartFromBytes } from './blob-part.js';

export class WebAudioArtifactDecoder implements NativeArtifactDecoder {
  constructor(runtimeAbi: CocosRuntimeAbi) {
    this.#runtimeAbi = runtimeAbi;
  }

  readonly artifactKind = ArtifactKind.bytes;
  readonly formats = ['mp3'] as const;

  async decode(
    context: NativeArtifactDecodeContext,
    signal: AbortSignal,
  ): Promise<NativeBinding> {
    throwIfAborted(signal);
    const bytes = requireByteArtifact(context.artifact).bytes;
    const objectUrl = URL.createObjectURL(new Blob([
      blobPartFromBytes(bytes),
    ], {
      type: 'audio/mpeg',
    }));

    try {
      const value = await this.#runtimeAbi.loadAudio(
        objectUrl,
        context.nativeDependency,
      );
      if (signal.aborted) {
        value.player.destroy();
        throwIfAborted(signal);
      }
      return new WebAudioNativeBinding(value, objectUrl);
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
  }

  readonly #runtimeAbi: CocosRuntimeAbi;
}

class WebAudioNativeBinding implements NativeBinding {
  constructor(value: CocosAudioMeta, objectUrl: string) {
    this.value = value;
    this.#objectUrl = objectUrl;
  }

  readonly value: CocosAudioMeta;

  discard(): void {
    this.#complete();
    this.value.player.destroy();
    URL.revokeObjectURL(this.#objectUrl);
  }

  release(): void {
    this.#complete();
    URL.revokeObjectURL(this.#objectUrl);
  }

  readonly #objectUrl: string;
  #completed = false;

  #complete(): void {
    invariant(
      !this.#completed,
      'Web audio native binding was already completed.',
    );
    this.#completed = true;
  }
}
