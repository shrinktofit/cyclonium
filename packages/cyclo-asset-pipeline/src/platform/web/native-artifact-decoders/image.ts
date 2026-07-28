import type { AbortSignal } from '@cyclonium/abort-controller';
import { invariant } from '@cyclonium/invariant';

import {
  ArtifactKind,
  type NativeBinding,
} from '../../../core/model.js';
import {
  type NativeArtifactDecodeContext,
  type NativeArtifactDecoder,
  requireByteArtifact,
  throwIfAborted,
} from '../../../runtime/cocos/native-artifact-decoder.js';
import { blobPartFromBytes } from './blob-part.js';

const IMAGE_CONTENT_TYPES = new Map([
  ['png', 'image/png'],
  ['jpeg', 'image/jpeg'],
  ['webp', 'image/webp'],
]);

export class WebImageArtifactDecoder implements NativeArtifactDecoder {
  readonly artifactKind = ArtifactKind.bytes;
  readonly formats = ['png', 'jpeg', 'webp'] as const;

  async decode(
    context: NativeArtifactDecodeContext,
    signal: AbortSignal,
  ): Promise<NativeBinding> {
    const image = await decodeWebImage(
      requireByteArtifact(context.artifact).bytes,
      context.format,
      signal,
    );
    return new WebImageNativeBinding(image);
  }
}

class WebImageNativeBinding implements NativeBinding {
  constructor(value: ImageBitmap) {
    this.value = value;
  }

  readonly value: ImageBitmap;

  discard(): void {
    invariant(
      !this.#completed,
      'Web image native binding was already completed.',
    );
    this.#completed = true;
    this.value.close();
  }

  release(): void {
    invariant(
      !this.#completed,
      'Web image native binding was already completed.',
    );
    this.#completed = true;
  }

  #completed = false;
}

async function decodeWebImage(
  bytes: Uint8Array,
  format: string,
  signal: AbortSignal,
): Promise<ImageBitmap> {
  throwIfAborted(signal);
  const image = await createImageBitmap(
    new Blob([blobPartFromBytes(bytes)], {
      type: contentTypeForImageFormat(format),
    }),
    {
      premultiplyAlpha: 'none',
    },
  );
  if (signal.aborted) {
    image.close();
    throwIfAborted(signal);
  }
  return image;
}

function contentTypeForImageFormat(format: string): string {
  const contentType = IMAGE_CONTENT_TYPES.get(format);
  if (contentType === undefined) {
    throw new Error(`Web image format "${format}" is not supported.`);
  }
  return contentType;
}
