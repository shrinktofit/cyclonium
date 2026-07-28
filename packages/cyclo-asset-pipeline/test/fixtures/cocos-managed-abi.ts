export const VERSION = '4.0.0';

interface SerializedDependency {
  readonly property: string | number;
  readonly type?: string;
  readonly uuid: string;
}

interface SerializedAsset {
  readonly audioLoadMode?: number;
  readonly dependencies?: readonly SerializedDependency[];
  readonly imageNativeData?: string | {
    readonly fmt: string;
    readonly h?: number;
    readonly w?: number;
  };
  readonly json?: Record<string, unknown>;
  readonly marker?: string;
  readonly native?: string;
  readonly text?: string;
  readonly type: string;
}

interface DeserializeOptions {
  readonly customEnv?: {
    readonly __uuid__?: string;
  };
}

class ManagedCcon {
  constructor(
    readonly document: unknown,
    readonly chunks: readonly Uint8Array[],
  ) {}
}

export const managedCocosAbiState = {
  createdAssets: [] as Asset[],
  decodeFailuresRemaining: new Map<string, number>(),
  deserializeCalls: 0,
  finalizeFailuresRemaining: new Map<string, number>(),
  onLoadedCalls: new Map<string, number>(),
  sceneSwitchCalls: 0,
  audioLoads: [] as string[],
  sampledTextureFormats: new Set<number>(),
  webpSupported: false,
};

export function resetManagedCocosAbiState(): void {
  managedCocosAbiState.createdAssets.length = 0;
  managedCocosAbiState.decodeFailuresRemaining.clear();
  managedCocosAbiState.deserializeCalls = 0;
  managedCocosAbiState.finalizeFailuresRemaining.clear();
  managedCocosAbiState.onLoadedCalls.clear();
  managedCocosAbiState.sceneSwitchCalls = 0;
  managedCocosAbiState.audioLoads.length = 0;
  managedCocosAbiState.sampledTextureFormats.clear();
  managedCocosAbiState.webpSupported = false;
  macro.SUPPORT_TEXTURE_FORMATS.splice(
    0,
    macro.SUPPORT_TEXTURE_FORMATS.length,
    '.png',
  );
}

export class Asset {
  _native = '';
  _nativeAsset: unknown;
  _nativeUrl = '';
  _uuid = '';
  destroyed = false;
  marker = '';

  destroy(): boolean {
    this.destroyed = true;
    return true;
  }

  onLoaded(): void {
    const calls = managedCocosAbiState.onLoadedCalls;
    calls.set(this._uuid, (calls.get(this._uuid) ?? 0) + 1);

    const failuresRemaining = managedCocosAbiState
      .finalizeFailuresRemaining
      .get(this._uuid) ?? 0;
    if (failuresRemaining > 0) {
      managedCocosAbiState.finalizeFailuresRemaining.set(
        this._uuid,
        failuresRemaining - 1,
      );
      throw new Error(`Fixture finalization failed for "${this._uuid}".`);
    }
  }
}

export class BufferAsset extends Asset {
  buffer(): ArrayBuffer {
    const nativeAsset = this._nativeAsset;
    if (nativeAsset instanceof ArrayBuffer) {
      return nativeAsset;
    }
    if (ArrayBuffer.isView(nativeAsset)) {
      return nativeAsset.buffer.slice(
        nativeAsset.byteOffset,
        nativeAsset.byteOffset + nativeAsset.byteLength,
      ) as ArrayBuffer;
    }
    return new ArrayBuffer(0);
  }
}

export class TextAsset extends Asset {
  text = '';
}

export class JsonAsset extends Asset {
  json: Record<string, unknown> | null = null;
}

export class TextureBase extends Asset {
  static readonly PixelFormat = {
    RGB_ETC1: 3,
    RGBA_ETC1: 1_002,
    RGB_ETC2: 2,
    RGBA_ETC2: 5,
  };
}

export class ImageAsset extends Asset {
  static parseCompressedTextures(
    bytes: Uint8Array,
    compressionType: number,
  ): object {
    return {
      bytes,
      compressionType,
    };
  }

  constructor(nativeAsset?: unknown) {
    super();
    this._nativeAsset = nativeAsset;
  }

  format = 0;

  _deserialize(data: string | {
    readonly fmt: string;
  }): void {
    const formatString = typeof data === 'string' ? data : data.fmt;
    let preferredExtensionIndex = Number.MAX_VALUE;
    let selectedExtension = '';
    let selectedFormat = this.format;
    for (const extensionId of formatString.split('_')) {
      const [extension, serializedFormat] = extensionId.split('@');
      const preferenceIndex = macro.SUPPORT_TEXTURE_FORMATS.indexOf(
        extension ?? '',
      );
      if (
        extension === undefined
        || preferenceIndex === -1
        || preferenceIndex >= preferredExtensionIndex
      ) {
        continue;
      }
      const pixelFormat = serializedFormat === undefined
        ? this.format
        : Number.parseInt(serializedFormat, 10);
      if (!supportsFixtureImageFormat(extension, pixelFormat)) {
        continue;
      }
      preferredExtensionIndex = preferenceIndex;
      selectedExtension = extension;
      selectedFormat = pixelFormat;
    }
    if (selectedExtension !== '') {
      this._native = selectedExtension;
      this.format = selectedFormat;
    }
  }

  reset(nativeAsset: unknown): void {
    this._nativeAsset = nativeAsset;
  }
}

export class Texture2D extends Asset {
  static readonly PixelFormat = TextureBase.PixelFormat;

  image: ImageAsset | null = null;
}

export class AudioClip extends Asset {
  static readonly AudioType = {
    DOM_AUDIO: 0,
    WEB_AUDIO: 1,
    MINIGAME_AUDIO: 2,
    NATIVE_AUDIO: 3,
    UNKNOWN_AUDIO: 4,
  };

  duration = 0;

  get _nativeDep(): object {
    return {
      audioLoadMode: AudioClip.AudioType.WEB_AUDIO,
    };
  }

  override destroy(): boolean {
    const nativeAsset = this._nativeAsset;
    if (isObject(nativeAsset)) {
      const player = Reflect.get(nativeAsset, 'player') as unknown;
      if (isObject(player)) {
        const destroy = Reflect.get(player, 'destroy') as unknown;
        if (typeof destroy === 'function') {
          Reflect.apply(destroy, player, []);
        }
      }
    }
    return super.destroy();
  }
}

export class Mesh extends Asset {}

export class TTFFont extends Asset {}

export class SpriteFrame extends Asset {
  texture: Texture2D | undefined;
}
export class EffectAsset extends Asset {}
export class Material extends Asset {
  effectAsset: EffectAsset | undefined;
}

export class Prefab extends Asset {
  dependency: Asset | undefined;
  material: Material | undefined;
  spriteFrame: SpriteFrame | undefined;
}

export class SceneAsset extends Asset {
  prefab: Prefab | undefined;
}

const CLASS_BY_ID = new Map<string, typeof Asset>([
  ['cc.Asset', Asset],
  ['cc.AudioClip', AudioClip],
  ['cc.BufferAsset', BufferAsset],
  ['cc.EffectAsset', EffectAsset],
  ['cc.ImageAsset', ImageAsset],
  ['cc.JsonAsset', JsonAsset],
  ['cc.Material', Material],
  ['cc.Mesh', Mesh],
  ['cc.Prefab', Prefab],
  ['cc.SceneAsset', SceneAsset],
  ['cc.SpriteFrame', SpriteFrame],
  ['cc.TextAsset', TextAsset],
  ['cc.Texture2D', Texture2D],
  ['cc.TTFFont', TTFFont],
]);

export const js = {
  getClassById(classId: string): typeof Asset | undefined {
    return CLASS_BY_ID.get(classId);
  },
  getClassName(value: object): string {
    for (const [classId, constructor] of CLASS_BY_ID) {
      if (value.constructor === constructor) {
        return classId;
      }
    }
    return value.constructor.name;
  },
};

export const gfx = {
  Format: {
    ASTC_RGBA_4X4: 1,
    ETC2_RGB8: 2,
    ETC_RGB8: 3,
    PVRTC_RGBA4: 4,
    ETC2_RGBA8: 5,
  },
  FormatFeatureBit: {
    SAMPLED_TEXTURE: 1,
  },
  deviceManager: {
    gfxDevice: {
      getFormatFeatures(format: number): number {
        return managedCocosAbiState.sampledTextureFormats.has(format)
          ? gfx.FormatFeatureBit.SAMPLED_TEXTURE
          : 0;
      },
    },
  },
};

export const macro = {
  SUPPORT_TEXTURE_FORMATS: ['.png'],
};

export const sys = {
  Feature: {
    WEBP: 'webp',
  },
  hasFeature(feature: string): boolean {
    return feature === sys.Feature.WEBP
      && managedCocosAbiState.webpSupported;
  },
};

export const director = {
  runScene(): void {
    managedCocosAbiState.sceneSwitchCalls += 1;
  },
};

export class Details {
  uuidList: string[] | null = null;
  uuidObjList: object[] | null = null;
  uuidPropList: Array<string | number> | null = null;
  uuidTypeList: string[] = [];
}

export function deserialize(
  serialized: unknown,
  details?: Details,
  _options?: DeserializeOptions,
): unknown {
  managedCocosAbiState.deserializeCalls += 1;

  const document = serialized instanceof ManagedCcon
    ? serialized.document
    : serialized;
  if (!isSerializedAsset(document)) {
    throw new Error('Fixture received an invalid serialized Cocos asset.');
  }

  const decodeFailuresRemaining = managedCocosAbiState
    .decodeFailuresRemaining
    .get(document.marker ?? '') ?? 0;
  if (decodeFailuresRemaining > 0) {
    managedCocosAbiState.decodeFailuresRemaining.set(
      document.marker ?? '',
      decodeFailuresRemaining - 1,
    );
    throw new Error(
      `Fixture deserialization failed for "${document.marker ?? ''}".`,
    );
  }

  const classId = document.type.startsWith('cc.')
    ? document.type
    : `cc.${document.type}`;
  const Constructor = CLASS_BY_ID.get(classId);
  const asset = Constructor === undefined
    ? new Asset()
    : new Constructor();
  asset.marker = document.marker ?? '';
  if (
    asset instanceof ImageAsset
    && document.imageNativeData !== undefined
  ) {
    asset._deserialize(document.imageNativeData);
  } else {
    asset._native = document.native ?? '';
  }
  if (asset instanceof JsonAsset) {
    asset.json = document.json ?? null;
  }
  if (asset instanceof TextAsset) {
    asset.text = document.text ?? '';
  }
  managedCocosAbiState.createdAssets.push(asset);

  if (details !== undefined) {
    const dependencies = document.dependencies ?? [];
    details.uuidList = dependencies.map((dependency) => dependency.uuid);
    details.uuidObjList = dependencies.map(() => asset);
    details.uuidPropList = dependencies.map(
      (dependency) => dependency.property,
    );
    details.uuidTypeList = dependencies.map(
      (dependency) => dependency.type ?? '',
    );
  }

  return asset;
}

function decodeCCONBinary(bytes: Uint8Array): ManagedCcon {
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );
  const documentByteLength = view.getUint32(12, true);
  const documentBytes = bytes.subarray(16, 16 + documentByteLength);
  const document = JSON.parse(
    new TextDecoder().decode(documentBytes),
  ) as unknown;
  return new ManagedCcon(document, []);
}

class FakeAudioPlayer {
  static load(url: string): Promise<FakeAudioPlayer> {
    managedCocosAbiState.audioLoads.push(url);
    return Promise.resolve(new FakeAudioPlayer());
  }

  readonly duration = 1;
  readonly type = AudioClip.AudioType.WEB_AUDIO;
  destroyed = false;

  destroy(): void {
    this.destroyed = true;
  }
}

export const cclegacy = {
  AudioPlayer: FakeAudioPlayer,
  internal: {
    decodeCCONBinary,
  },
};

function isSerializedAsset(value: unknown): value is SerializedAsset {
  return typeof value === 'object'
    && value !== null
    && 'type' in value
    && typeof Reflect.get(value, 'type') === 'string';
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function supportsFixtureImageFormat(
  extension: string,
  pixelFormat: number,
): boolean {
  const supported = managedCocosAbiState.sampledTextureFormats;
  if (extension === '.astc') {
    return supported.has(gfx.Format.ASTC_RGBA_4X4);
  }
  if (extension === '.pvr') {
    return supported.has(gfx.Format.PVRTC_RGBA4);
  }
  if (
    pixelFormat === TextureBase.PixelFormat.RGB_ETC1
    || pixelFormat === TextureBase.PixelFormat.RGBA_ETC1
  ) {
    return supported.has(gfx.Format.ETC_RGB8);
  }
  if (
    pixelFormat === TextureBase.PixelFormat.RGB_ETC2
    || pixelFormat === TextureBase.PixelFormat.RGBA_ETC2
  ) {
    return supported.has(gfx.Format.ETC2_RGB8);
  }
  if (extension === '.webp') {
    return managedCocosAbiState.webpSupported;
  }
  return true;
}
