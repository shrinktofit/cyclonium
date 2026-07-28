import * as cc from 'cc';

import type { AbortSignal } from '@cyclonium/abort-controller';
import { invariant } from '@cyclonium/invariant';

import {
  ArtifactKind,
  type Artifact,
  type ByteArtifact,
  type NativeBinding,
} from '../../core/model.js';

const COMPRESSED_TEXTURE_TYPES = new Map<string, number>([
  ['pvr', 0],
  ['pkm', 1],
  ['astc', 2],
]);

export interface NativeArtifactDecodeContext {
  readonly artifact: Artifact;
  readonly format: string;
  readonly nativeDependency: unknown;
  readonly nativeName: string;
}

export interface NativeArtifactDecoder {
  readonly artifactKind: ArtifactKind;
  readonly formats: readonly string[];

  decode(
    context: NativeArtifactDecodeContext,
    signal: AbortSignal,
  ): Promise<NativeBinding>;
}

export class NativeArtifactDecoderRegistry {
  constructor(decoders: readonly NativeArtifactDecoder[]) {
    for (const decoder of decoders) {
      for (const declaredFormat of decoder.formats) {
        const format = normalizeNativeFormat(declaredFormat);
        if (this.#decoders.has(format)) {
          throw new Error(
            `A native artifact decoder is already registered for "${format}".`,
          );
        }
        this.#decoders.set(format, decoder);
      }
    }
  }

  decode(
    artifact: Artifact,
    nativeName: string,
    nativeDependency: unknown,
    signal: AbortSignal,
  ): Promise<NativeBinding> {
    const format = normalizeNativeFormat(artifact.format);
    const decoder = this.#decoders.get(format);
    if (decoder === undefined) {
      return Promise.reject(new Error(
        `Native artifact format "${format}" is not supported.`,
      ));
    }
    if (artifact.kind !== decoder.artifactKind) {
      return Promise.reject(new Error(
        `Native artifact format "${format}" requires `
        + `a ${decoder.artifactKind} artifact, received ${artifact.kind}.`,
      ));
    }
    return decoder.decode({
      artifact,
      format,
      nativeDependency,
      nativeName,
    }, signal);
  }

  artifactKindFor(formats: ReadonlySet<string>): ArtifactKind {
    let artifactKind: ArtifactKind | undefined;
    for (const declaredFormat of formats) {
      const format = normalizeNativeFormat(declaredFormat);
      const decoder = this.#decoders.get(format);
      if (decoder === undefined) {
        throw new Error(
          `Native artifact format "${format}" is not supported.`,
        );
      }
      if (
        artifactKind !== undefined
        && artifactKind !== decoder.artifactKind
      ) {
        throw new Error(
          'Remote formats for one AssetType require different artifact kinds.',
        );
      }
      artifactKind = decoder.artifactKind;
    }
    if (artifactKind === undefined) {
      throw new Error('At least one native artifact format is required.');
    }
    return artifactKind;
  }

  readonly #decoders = new Map<string, NativeArtifactDecoder>();
}

export class BinaryArtifactDecoder implements NativeArtifactDecoder {
  readonly artifactKind = ArtifactKind.bytes;
  readonly formats = ['bin', 'binary'] as const;

  decode(
    context: NativeArtifactDecodeContext,
    signal: AbortSignal,
  ): Promise<NativeBinding> {
    throwIfAborted(signal);
    return Promise.resolve(new BinaryNativeBinding(
      exactArrayBuffer(requireByteArtifact(context.artifact).bytes),
    ));
  }
}

export class CompressedTextureArtifactDecoder implements NativeArtifactDecoder {
  readonly artifactKind = ArtifactKind.bytes;
  readonly formats = ['pvr', 'pkm', 'astc'] as const;

  decode(
    context: NativeArtifactDecodeContext,
    signal: AbortSignal,
  ): Promise<NativeBinding> {
    throwIfAborted(signal);
    const compressionType = COMPRESSED_TEXTURE_TYPES.get(context.format);
    if (compressionType === undefined) {
      throw new Error(
        `Compressed texture format "${context.format}" is not supported.`,
      );
    }

    const parser = Reflect.get(
      cc.ImageAsset,
      'parseCompressedTextures',
    ) as unknown;
    if (typeof parser !== 'function' || parser.length !== 2) {
      throw new Error(
        'cc.ImageAsset.parseCompressedTextures does not match the '
        + 'Vortex 4.0.0-alpha.23 ABI.',
      );
    }

    const value = Reflect.apply(
      parser,
      cc.ImageAsset,
      [requireByteArtifact(context.artifact).bytes, compressionType],
    ) as unknown;
    if (typeof value !== 'object' || value === null) {
      throw new Error(
        `Cocos failed to decode the ${context.format} texture artifact.`,
      );
    }
    return Promise.resolve(new CompressedTextureNativeBinding(value));
  }
}

class BinaryNativeBinding implements NativeBinding {
  constructor(value: ArrayBuffer) {
    this.value = value;
  }

  readonly value: ArrayBuffer;

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
      'Binary native binding was already completed.',
    );
    this.#completed = true;
  }
}

class CompressedTextureNativeBinding implements NativeBinding {
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
      'Compressed texture native binding was already completed.',
    );
    this.#completed = true;
  }
}

export function createNativeArtifactDecoderRegistry(
  platformDecoders: readonly NativeArtifactDecoder[],
): NativeArtifactDecoderRegistry {
  return new NativeArtifactDecoderRegistry([
    new BinaryArtifactDecoder(),
    new CompressedTextureArtifactDecoder(),
    ...platformDecoders,
  ]);
}

export function normalizeNativeFormat(format: string): string {
  const normalized = format.trim().toLowerCase();
  const withoutDot = normalized.startsWith('.')
    ? normalized.slice(1)
    : normalized;
  return withoutDot === 'jpg' ? 'jpeg' : withoutDot;
}

export function requireByteArtifact(artifact: Artifact): ByteArtifact {
  if (artifact.kind !== ArtifactKind.bytes) {
    throw new Error('The native artifact decoder requires byte data.');
  }
  return artifact;
}

export function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = bytes.buffer;
  if (
    buffer instanceof ArrayBuffer
    && bytes.byteOffset === 0
    && bytes.byteLength === buffer.byteLength
  ) {
    return buffer;
  }
  return bytes.slice().buffer;
}

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    const error = new Error('Native artifact decoding was aborted.');
    error.name = 'AbortError';
    throw error;
  }
}
