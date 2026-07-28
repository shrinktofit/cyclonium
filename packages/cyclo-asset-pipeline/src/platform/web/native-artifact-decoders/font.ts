import type { AbortSignal } from '@cyclonium/abort-controller';
import { invariant } from '@cyclonium/invariant';

import {
  ArtifactKind,
  type NativeBinding,
} from '../../../core/model.js';
import {
  exactArrayBuffer,
  type NativeArtifactDecodeContext,
  type NativeArtifactDecoder,
  requireByteArtifact,
  throwIfAborted,
} from '../../../runtime/cocos/native-artifact-decoder.js';

export class WebFontArtifactDecoder implements NativeArtifactDecoder {
  readonly artifactKind = ArtifactKind.bytes;
  readonly formats = ['ttf'] as const;

  async decode(
    context: NativeArtifactDecodeContext,
    signal: AbortSignal,
  ): Promise<NativeBinding> {
    throwIfAborted(signal);
    if (typeof FontFace !== 'function') {
      throw new Error('The Web runtime does not expose FontFace.');
    }
    const family = `CycloFont_${this.#nextFamilyId}`;
    this.#nextFamilyId += 1;
    const face = new FontFace(
      family,
      exactArrayBuffer(requireByteArtifact(context.artifact).bytes),
    );
    await face.load();
    throwIfAborted(signal);
    document.fonts.add(face);
    return new WebFontNativeBinding(family, face);
  }

  #nextFamilyId = 1;
}

class WebFontNativeBinding implements NativeBinding {
  constructor(value: string, face: FontFace) {
    this.value = value;
    this.#face = face;
  }

  readonly value: string;

  discard(): void {
    this.#remove();
  }

  release(): void {
    this.#remove();
  }

  readonly #face: FontFace;
  #removed = false;

  #remove(): void {
    invariant(
      !this.#removed,
      'Web font native binding was already completed.',
    );
    this.#removed = true;
    document.fonts.delete(this.#face);
  }
}
