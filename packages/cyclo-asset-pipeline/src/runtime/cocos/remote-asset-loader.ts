import * as cc from 'cc';

import type { AbortSignal } from '@cyclonium/abort-controller';

import type {
  RemoteAssetInstantiation,
  RemoteAssetLoader,
  RemoteAssetRequest,
} from '../../core/contracts.js';
import {
  ArtifactKind,
  type Artifact,
  type ArtifactLocation,
  type ArtifactSourceId,
  type NativeBinding,
} from '../../core/model.js';
import {
  type RemoteAssetProvider,
  RemoteAssetTypeRegistry,
} from '../../core/remote-asset-registry.js';
import {
  assertRemoteFormatSupported,
  formatFromRemoteRequest,
  resolveRemoteFormat,
} from '../../core/remote-format.js';
import type {
  AssetType,
  CycloAsset,
} from '../../core/public.js';
import {
  exactArrayBuffer,
  NativeArtifactDecoderRegistry,
  requireByteArtifact,
} from './native-artifact-decoder.js';

const TEXT_FORMATS = new Set(['text', 'txt', 'json']);
const JSON_FORMATS = new Set(['json']);
const IMAGE_FORMATS = new Set(['png', 'jpeg', 'webp']);
const AUDIO_FORMATS = new Set(['mp3']);

export function createRemoteAssetLoader(
  sourceId: ArtifactSourceId,
  nativeArtifactDecoders: NativeArtifactDecoderRegistry,
): RemoteAssetLoader {
  return new RemoteAssetTypeRegistry(sourceId, [
    new BufferAssetProvider(),
    new TextAssetProvider(),
    new JsonAssetProvider(),
    new ImageAssetProvider(nativeArtifactDecoders),
    new TextureAssetProvider(nativeArtifactDecoders),
    new AudioAssetProvider(nativeArtifactDecoders),
  ]);
}

class BufferAssetProvider implements RemoteAssetProvider {
  readonly assetType: AssetType<CycloAsset> = cc.BufferAsset;

  resolve(
    request: RemoteAssetRequest<CycloAsset>,
    sourceId: ArtifactSourceId,
  ): ArtifactLocation {
    return {
      sourceId,
      key: request.url,
      format: 'bytes',
      preferredKind: ArtifactKind.bytes,
    };
  }

  instantiate(
    _request: RemoteAssetRequest<CycloAsset>,
    artifact: Artifact,
  ): Promise<RemoteAssetInstantiation<CycloAsset>> {
    const asset = new cc.BufferAsset();
    asset._nativeAsset = exactArrayBuffer(
      requireByteArtifact(artifact).bytes,
    );
    return Promise.resolve({ asset });
  }
}

abstract class FormattedRemoteAssetProvider implements RemoteAssetProvider {
  readonly assetType: AssetType<CycloAsset>;

  resolve(
    request: RemoteAssetRequest<CycloAsset>,
    sourceId: ArtifactSourceId,
  ): ArtifactLocation {
    return {
      sourceId,
      key: request.url,
      format: formatFromRemoteRequest(
        request.explicitFormat,
        request.url,
      ),
      preferredKind: this.#artifactKind,
    };
  }

  instantiate(
    request: RemoteAssetRequest<CycloAsset>,
    artifact: Artifact,
    signal: AbortSignal,
  ): Promise<RemoteAssetInstantiation<CycloAsset>> {
    const format = resolveRemoteFormat(
      request.explicitFormat,
      request.url,
      artifact.contentType,
    );
    assertRemoteFormatSupported(
      format,
      this.#supportedFormats,
      this.#assetDescription,
    );
    return this.createAsset(artifact, format, signal);
  }

  protected constructor(
    assetType: AssetType<CycloAsset>,
    assetDescription: string,
    supportedFormats: ReadonlySet<string>,
    artifactKind: ArtifactKind,
  ) {
    this.assetType = assetType;
    this.#assetDescription = assetDescription;
    this.#supportedFormats = supportedFormats;
    this.#artifactKind = artifactKind;
  }

  protected abstract createAsset(
    artifact: Artifact,
    format: string,
    signal: AbortSignal,
  ): Promise<RemoteAssetInstantiation<CycloAsset>>;

  readonly #artifactKind: ArtifactKind;
  readonly #assetDescription: string;
  readonly #supportedFormats: ReadonlySet<string>;
}

class TextAssetProvider extends FormattedRemoteAssetProvider {
  constructor() {
    super(cc.TextAsset, 'text', TEXT_FORMATS, ArtifactKind.bytes);
  }

  protected createAsset(
    artifact: Artifact,
  ): Promise<RemoteAssetInstantiation<CycloAsset>> {
    const asset = new cc.TextAsset();
    asset.text = decodeUtf8(requireByteArtifact(artifact).bytes);
    return Promise.resolve({ asset });
  }
}

class JsonAssetProvider extends FormattedRemoteAssetProvider {
  constructor() {
    super(cc.JsonAsset, 'json', JSON_FORMATS, ArtifactKind.bytes);
  }

  protected createAsset(
    artifact: Artifact,
  ): Promise<RemoteAssetInstantiation<CycloAsset>> {
    const asset = new cc.JsonAsset();
    const json = JSON.parse(
      decodeUtf8(requireByteArtifact(artifact).bytes),
    ) as unknown;
    if (!Reflect.set(asset, 'json', json)) {
      throw new Error('Cocos rejected the remote JsonAsset value.');
    }
    return Promise.resolve({ asset });
  }
}

abstract class NativeRemoteAssetProvider
  extends FormattedRemoteAssetProvider {
  protected constructor(
    assetType: AssetType<CycloAsset>,
    assetDescription: string,
    supportedFormats: ReadonlySet<string>,
    nativeArtifactDecoders: NativeArtifactDecoderRegistry,
  ) {
    super(
      assetType,
      assetDescription,
      supportedFormats,
      nativeArtifactDecoders.artifactKindFor(supportedFormats),
    );
    this.nativeArtifactDecoders = nativeArtifactDecoders;
  }

  protected readonly nativeArtifactDecoders: NativeArtifactDecoderRegistry;

  protected decodeNative(
    artifact: Artifact,
    format: string,
    signal: AbortSignal,
  ): Promise<NativeBinding> {
    return this.nativeArtifactDecoders.decode(
      {
        ...artifact,
        format,
      },
      '',
      undefined,
      signal,
    );
  }
}

class ImageAssetProvider extends NativeRemoteAssetProvider {
  constructor(nativeArtifactDecoders: NativeArtifactDecoderRegistry) {
    super(
      cc.ImageAsset,
      'image',
      IMAGE_FORMATS,
      nativeArtifactDecoders,
    );
  }

  protected async createAsset(
    artifact: Artifact,
    format: string,
    signal: AbortSignal,
  ): Promise<RemoteAssetInstantiation<CycloAsset>> {
    const native = await this.decodeNative(artifact, format, signal);
    const asset = new cc.ImageAsset();
    return linkRemoteNative(asset, native);
  }
}

class TextureAssetProvider extends NativeRemoteAssetProvider {
  constructor(nativeArtifactDecoders: NativeArtifactDecoderRegistry) {
    super(
      cc.Texture2D,
      'texture',
      IMAGE_FORMATS,
      nativeArtifactDecoders,
    );
  }

  protected async createAsset(
    artifact: Artifact,
    format: string,
    signal: AbortSignal,
  ): Promise<RemoteAssetInstantiation<CycloAsset>> {
    const native = await this.decodeNative(artifact, format, signal);
    const image = new cc.ImageAsset();
    let linked = false;
    try {
      linkNativeValue(image, native.value);
      linked = true;
      const texture = new OwnedImageTexture2D(image);
      texture.image = image;
      texture.onLoaded();
      return {
        asset: texture,
        nativeBinding: native,
      };
    } catch (error) {
      try {
        image.destroy();
      } finally {
        if (linked) {
          native.release();
        } else {
          native.discard();
        }
      }
      throw error;
    }
  }
}

class AudioAssetProvider extends NativeRemoteAssetProvider {
  constructor(nativeArtifactDecoders: NativeArtifactDecoderRegistry) {
    super(
      cc.AudioClip,
      'audio',
      AUDIO_FORMATS,
      nativeArtifactDecoders,
    );
  }

  protected async createAsset(
    artifact: Artifact,
    format: string,
    signal: AbortSignal,
  ): Promise<RemoteAssetInstantiation<CycloAsset>> {
    const native = await this.decodeNative(artifact, format, signal);
    const duration = readAudioDuration(native.value);
    const asset = new cc.AudioClip();
    const linked = linkRemoteNative(asset, native);
    try {
      if (!Reflect.set(asset, 'duration', duration)) {
        throw new Error('Cocos rejected the remote audio duration.');
      }
      return linked;
    } catch (error) {
      try {
        asset.destroy();
      } finally {
        native.release();
      }
      throw error;
    }
  }
}

class OwnedImageTexture2D extends cc.Texture2D {
  constructor(ownedImage: cc.ImageAsset) {
    super();
    this.#ownedImage = ownedImage;
  }

  override destroy(): boolean {
    const result = super.destroy();
    if (!this.#ownedImageReleased) {
      this.#ownedImageReleased = true;
      this.#ownedImage.destroy();
    }
    return result;
  }

  readonly #ownedImage: cc.ImageAsset;
  #ownedImageReleased = false;
}

function linkRemoteNative<TAsset extends CycloAsset>(
  asset: TAsset,
  native: NativeBinding,
): RemoteAssetInstantiation<TAsset> {
  let linked = false;
  try {
    linkNativeValue(asset, native.value);
    linked = true;
    return {
      asset,
      nativeBinding: native,
    };
  } catch (error) {
    try {
      asset.destroy();
    } finally {
      if (linked) {
        native.release();
      } else {
        native.discard();
      }
    }
    throw error;
  }
}

function linkNativeValue(asset: CycloAsset, value: unknown): void {
  if (!Reflect.set(asset, '_nativeAsset', value)) {
    throw new Error('Cocos rejected the remote native asset value.');
  }
}

function readAudioDuration(value: unknown): number {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Cocos audio metadata must be an object.');
  }
  const duration = Reflect.get(value, 'duration') as unknown;
  if (typeof duration !== 'number') {
    throw new Error('Cocos audio metadata must contain a numeric duration.');
  }
  return duration;
}

function decodeUtf8(bytes: Uint8Array): string {
  let result = '';
  for (let index = 0; index < bytes.length;) {
    const first = bytes[index];
    if (first === undefined) {
      break;
    }

    if (first <= 0x7F) {
      result += String.fromCodePoint(first);
      index += 1;
      continue;
    }

    let codePoint: number;
    let length: number;
    let minimum: number;
    if ((first & 0xE0) === 0xC0) {
      codePoint = first & 0x1F;
      length = 2;
      minimum = 0x80;
    } else if ((first & 0xF0) === 0xE0) {
      codePoint = first & 0x0F;
      length = 3;
      minimum = 0x800;
    } else if ((first & 0xF8) === 0xF0) {
      codePoint = first & 0x07;
      length = 4;
      minimum = 0x10000;
    } else {
      throw new TypeError('Remote text contains invalid UTF-8.');
    }

    if (index + length > bytes.length) {
      throw new TypeError('Remote text contains truncated UTF-8.');
    }
    for (let offset = 1; offset < length; offset += 1) {
      const continuation = bytes[index + offset];
      if (continuation === undefined || (continuation & 0xC0) !== 0x80) {
        throw new TypeError('Remote text contains invalid UTF-8.');
      }
      codePoint = (codePoint << 6) | (continuation & 0x3F);
    }

    if (
      codePoint < minimum
      || codePoint > 0x10FFFF
      || (codePoint >= 0xD800 && codePoint <= 0xDFFF)
    ) {
      throw new TypeError('Remote text contains invalid UTF-8.');
    }
    result += String.fromCodePoint(codePoint);
    index += length;
  }
  return result;
}
