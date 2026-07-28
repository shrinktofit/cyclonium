export const VERSION = '4.0.0';

export const settings = {
  querySettings(_category: string, _name: string): unknown {
    return Reflect.get(globalThis, '__cycloAssetCatalogPointer');
  },
};

export class Asset {
  _native = '';
  _nativeAsset: unknown;
  _nativeUrl = '';
  _uuid = '';
  destroyed = false;

  destroy(): boolean {
    this.destroyed = true;
    return true;
  }

  onLoaded(): void {
    return undefined;
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

export class ImageAsset extends Asset {
  constructor(nativeAsset?: unknown) {
    super();
    this._nativeAsset = nativeAsset;
  }
}

export class Texture2D extends Asset {
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

  override destroy(): boolean {
    const nativeAsset = this._nativeAsset;
    if (typeof nativeAsset === 'object' && nativeAsset !== null) {
      const player = Reflect.get(nativeAsset, 'player') as unknown;
      if (typeof player === 'object' && player !== null) {
        const destroy = Reflect.get(player, 'destroy') as unknown;
        if (typeof destroy === 'function') {
          Reflect.apply(destroy, player, []);
        }
      }
    }
    return super.destroy();
  }
}

export class SpriteFrame extends Asset {}
export class EffectAsset extends Asset {}
export class Material extends Asset {}
export class Prefab extends Asset {}
export class SceneAsset extends Asset {}

export const gfx = {
  Format: {
    ASTC_RGBA_4X4: 1,
    ETC2_RGB8: 2,
    ETC_RGB8: 3,
    PVRTC_RGBA4: 4,
  },
  FormatFeatureBit: {
    SAMPLED_TEXTURE: 1,
  },
  deviceManager: {
    gfxDevice: {
      getFormatFeatures(): number {
        return 0;
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
  hasFeature(): boolean {
    return false;
  },
};

export const js = {
  getClassById(id: string): typeof Asset | undefined {
    return new Map<string, typeof Asset>([
      ['cc.Asset', Asset],
      ['cc.BufferAsset', BufferAsset],
      ['cc.TextAsset', TextAsset],
      ['cc.JsonAsset', JsonAsset],
      ['cc.ImageAsset', ImageAsset],
      ['cc.Texture2D', Texture2D],
      ['cc.AudioClip', AudioClip],
      ['cc.SpriteFrame', SpriteFrame],
      ['cc.EffectAsset', EffectAsset],
      ['cc.Material', Material],
      ['cc.Prefab', Prefab],
      ['cc.SceneAsset', SceneAsset],
    ]).get(id);
  },
  getClassName(value: object): string {
    return value.constructor.name;
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
): unknown {
  if (details !== undefined) {
    details.uuidList = [];
    details.uuidObjList = [];
    details.uuidPropList = [];
    details.uuidTypeList = [];
  }
  return serialized;
}

function decodeCCONBinary(_bytes: Uint8Array): {
  readonly document: unknown;
  readonly chunks: readonly Uint8Array[];
} {
  return {
    document: {},
    chunks: [],
  };
}

class FakeAudioPlayer {
  static load(url: string): Promise<FakeAudioPlayer> {
    return Promise.resolve(new FakeAudioPlayer(url));
  }

  constructor(readonly url: string) {}

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
