import {
  cclegacy,
  EffectAsset,
  ImageAsset,
  Material,
  Node,
  Prefab,
  Scene,
  SceneAsset,
  SpriteFrame,
  Texture2D,
} from 'cc';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { assetPipeline } from '../../src/index.js';
import {
  BrowserManagedAsset,
  MANAGED_ASSET_CLASS_ID,
  MANAGED_BINP_ONE_KEY,
  MANAGED_BINP_ZERO_KEY,
  MANAGED_CCON_KEY,
  MANAGED_JSON_KEY,
  MANAGED_MATRIX_KEY,
  MANAGED_UUIDS,
  managedOnLoadedCalls,
} from './browser-runtime-configuration.js';

const textEncoder = new TextEncoder();

beforeAll(async () => {
  const equivalentDocument = createManagedDocument('equivalent');
  const artifacts = new Map<string, Uint8Array>([
    [
      'managed-json',
      encodeJson(equivalentDocument),
    ],
    [
      'managed-ccon',
      encodeCcon(equivalentDocument),
    ],
    [
      'shared-binp',
      encodeBinPackV2([
        encodeCcon(createManagedDocument('binp-entry-zero')),
        encodeCcon(createManagedDocument('binp-entry-one')),
      ]),
    ],
    [
      'managed-image',
      encodeJson({
        __type__: 'cc.ImageAsset',
        content: '',
      }),
    ],
    [
      'managed-texture',
      encodeJson({
        __type__: 'cc.Texture2D',
        content: {
          base: '',
          mipmaps: [MANAGED_UUIDS.image],
        },
      }),
    ],
    [
      'managed-sprite-frame',
      encodeJson({
        __type__: 'cc.SpriteFrame',
        content: {
          name: 'managed-sprite-frame',
          rect: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
          },
          offset: {
            x: 0,
            y: 0,
          },
          originalSize: {
            width: 0,
            height: 0,
          },
          rotated: false,
          capInsets: [0, 0, 0, 0],
          texture: MANAGED_UUIDS.texture,
          packable: false,
          pixelsToUnit: 100,
          pivot: {
            x: 0.5,
            y: 0.5,
          },
          meshType: 0,
        },
      }),
    ],
    [
      'managed-effect',
      encodeJson({
        __type__: 'cc.EffectAsset',
        techniques: [{
          passes: [],
        }],
        shaders: [],
        combinations: [],
      }),
    ],
    [
      'managed-material',
      encodeJson({
        __type__: 'cc.Material',
        _effectAsset: {
          __uuid__: MANAGED_UUIDS.effect,
        },
        _techIdx: 0,
        _defines: [],
        _states: [],
        _props: [],
      }),
    ],
    [
      'managed-prefab',
      encodeJson([
        {
          __type__: 'cc.Prefab',
          data: {
            __id__: 1,
          },
          optimizationPolicy: 0,
          persistent: false,
        },
        {
          __type__: 'cc.Node',
          _name: 'ManagedPrefabRoot',
        },
      ]),
    ],
    [
      'managed-scene',
      encodeJson([
        {
          __type__: 'cc.SceneAsset',
          scene: {
            __id__: 1,
          },
        },
        {
          __type__: 'cc.Scene',
          _name: 'ManagedScene',
        },
      ]),
    ],
    [
      'managed-matrix',
      encodeJson(createManagedDocument('matrix', {
        image: MANAGED_UUIDS.image,
        texture: MANAGED_UUIDS.texture,
        spriteFrame: MANAGED_UUIDS.spriteFrame,
        effect: MANAGED_UUIDS.effect,
        material: MANAGED_UUIDS.material,
        prefab: MANAGED_UUIDS.prefab,
        scene: MANAGED_UUIDS.scene,
      })),
    ],
  ]);

  await Promise.all([...artifacts].map(([key, bytes]) => (
    publishManagedArtifact(key, bytes)
  )));
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('Web managed assets with the real Cocos runtime', () => {
  it('deserializes equivalent JSON and standalone CCONB Assets', async () => {
    /// @case
    /// Equivalent Cocos documents are served as UTF-8 JSON and as a standalone
    /// CCONB produced by the real runtime encodeCCONBinary implementation.
    /// @expect
    /// Public loadAsset reconstructs the registered real cc.Asset subclass
    /// with equal data and finalizes each runtime object exactly once.
    const jsonHandle = assetPipeline.loadAsset<BrowserManagedAsset>(
      MANAGED_JSON_KEY,
    );
    const cconHandle = assetPipeline.loadAsset<BrowserManagedAsset>(
      MANAGED_CCON_KEY,
    );
    const [jsonAsset, cconAsset] = await Promise.all([
      jsonHandle.ready,
      cconHandle.ready,
    ]);

    expect(jsonAsset).toBeInstanceOf(BrowserManagedAsset);
    expect(cconAsset).toBeInstanceOf(BrowserManagedAsset);
    expect(jsonAsset.marker).toBe('equivalent');
    expect(cconAsset.marker).toBe(jsonAsset.marker);
    expect(managedOnLoadedCalls.get(MANAGED_UUIDS.json)).toBe(1);
    expect(managedOnLoadedCalls.get(MANAGED_UUIDS.ccon)).toBe(1);

    jsonHandle.release();
    cconHandle.release();
  });

  it('loads two BINP-v2 CCONB entries with one HTTP acquisition', async () => {
    /// @case
    /// Two Catalog records point at different CCONB entries in one BINP-v2
    /// artifact served by the local HTTP server.
    /// @expect
    /// Both public Handles receive their own real Cocos Asset while the Web
    /// Source fetches the shared byte artifact exactly once.
    const zeroHandle = assetPipeline.loadAsset<BrowserManagedAsset>(
      MANAGED_BINP_ZERO_KEY,
    );
    const oneHandle = assetPipeline.loadAsset<BrowserManagedAsset>(
      MANAGED_BINP_ONE_KEY,
    );
    const [zero, one] = await Promise.all([
      zeroHandle.ready,
      oneHandle.ready,
    ]);

    expect(zero.marker).toBe('binp-entry-zero');
    expect(one.marker).toBe('binp-entry-one');
    await expect(managedArtifactAcquireCount('shared-binp')).resolves.toBe(1);
    expect(managedOnLoadedCalls.get(MANAGED_UUIDS.binpZero)).toBe(1);
    expect(managedOnLoadedCalls.get(MANAGED_UUIDS.binpOne)).toBe(1);

    zeroHandle.release();
    oneHandle.release();
  });

  it('links the supported Cocos Asset matrix through UUID slots', async () => {
    /// @case
    /// A real Cocos-deserialized root references ImageAsset, Texture2D,
    /// SpriteFrame, EffectAsset, Material, Prefab, and SceneAsset Catalog
    /// records through serialized UUID slots.
    /// @expect
    /// The managed graph injects the canonical runtime instances, preserves
    /// verified engine relationships, and invokes every onLoaded method once.
    const onLoadedSpies = [
      vi.spyOn(ImageAsset.prototype, 'onLoaded'),
      vi.spyOn(Texture2D.prototype, 'onLoaded'),
      vi.spyOn(SpriteFrame.prototype, 'onLoaded'),
      vi.spyOn(EffectAsset.prototype, 'onLoaded'),
      vi.spyOn(Material.prototype, 'onLoaded'),
      vi.spyOn(Prefab.prototype, 'onLoaded'),
      vi.spyOn(SceneAsset.prototype, 'onLoaded'),
    ] as const;

    const handle = assetPipeline.loadAsset<BrowserManagedAsset>(
      MANAGED_MATRIX_KEY,
    );
    const matrix = await handle.ready;

    expect(matrix.image).toBeInstanceOf(ImageAsset);
    expect(matrix.texture).toBeInstanceOf(Texture2D);
    expect(matrix.texture?.image).toBe(matrix.image);
    expect(matrix.spriteFrame).toBeInstanceOf(SpriteFrame);
    expect(matrix.effect).toBeInstanceOf(EffectAsset);
    expect(matrix.material).toBeInstanceOf(Material);
    expect(matrix.material?.effectAsset).toBe(matrix.effect);
    expect(matrix.prefab).toBeInstanceOf(Prefab);
    expect(matrix.prefab?.data).toBeInstanceOf(Node);
    expect(matrix.scene).toBeInstanceOf(SceneAsset);
    expect(matrix.scene?.scene).toBeInstanceOf(Scene);

    handle.release();
    await Promise.resolve();

    expect(managedOnLoadedCalls.get(MANAGED_UUIDS.matrix)).toBe(1);
    for (const spy of onLoadedSpies) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });
});

function createManagedDocument(
  marker: string,
  dependencies: Readonly<Record<string, string>> = {},
): Record<string, unknown> {
  return {
    __type__: MANAGED_ASSET_CLASS_ID,
    marker,
    ...Object.fromEntries(Object.entries(dependencies).map(
      ([property, uuid]) => [
        property,
        {
          __uuid__: uuid,
        },
      ],
    )),
  };
}

function encodeJson(value: unknown): Uint8Array {
  return textEncoder.encode(JSON.stringify(value));
}

function encodeCcon(document: unknown): Uint8Array {
  const internal = requireCocosInternal();
  const Ccon = Reflect.get(internal, 'CCON') as unknown;
  const encode = Reflect.get(internal, 'encodeCCONBinary') as unknown;
  if (typeof Ccon !== 'function' || typeof encode !== 'function') {
    throw new Error(
      'The real Cocos runtime does not expose CCON encoding support.',
    );
  }

  const ccon = Reflect.construct(Ccon, [document, []]) as object;
  const bytes = Reflect.apply(encode, internal, [ccon]) as unknown;
  if (!(bytes instanceof Uint8Array)) {
    throw new Error('Cocos encodeCCONBinary returned non-byte data.');
  }
  return bytes;
}

function requireCocosInternal(): object {
  const internal = Reflect.get(cclegacy, 'internal') as unknown;
  if (typeof internal !== 'object' || internal === null) {
    throw new Error('The real Cocos runtime does not expose cclegacy.internal.');
  }
  return internal;
}

function encodeBinPackV2(entries: readonly Uint8Array[]): Uint8Array {
  const uint32ByteLength = 4;
  const tableByteLength = (
    3 + entries.length * 2
  ) * uint32ByteLength;
  const payloadByteLength = entries.reduce(
    (total, entry) => total + entry.byteLength,
    0,
  );
  const result = new Uint8Array(tableByteLength + payloadByteLength);
  result.set(textEncoder.encode('BINP'), 0);

  const view = new DataView(result.buffer);
  view.setUint32(uint32ByteLength, 2, true);
  view.setUint32(uint32ByteLength * 2, entries.length, true);

  let relativeOffset = 0;
  for (const [index, entry] of entries.entries()) {
    const tableOffset = (
      3 + index * 2
    ) * uint32ByteLength;
    view.setUint32(tableOffset, relativeOffset, true);
    view.setUint32(tableOffset + uint32ByteLength, entry.byteLength, true);
    result.set(entry, tableByteLength + relativeOffset);
    relativeOffset += entry.byteLength;
  }
  return result;
}

async function publishManagedArtifact(
  key: string,
  bytes: Uint8Array,
): Promise<void> {
  const response = await fetch(managedArtifactUrl(key), {
    method: 'POST',
    body: Uint8Array.from(bytes).buffer,
  });
  if (!response.ok) {
    throw new Error(
      `Publishing managed fixture "${key}" failed with ${response.status}.`,
    );
  }
}

async function managedArtifactAcquireCount(key: string): Promise<number> {
  const response = await fetch(
    `/__cyclo_asset_pipeline__/managed-count/${encodeURIComponent(key)}`,
  );
  if (!response.ok) {
    throw new Error(
      `Reading managed fixture count "${key}" failed with ${response.status}.`,
    );
  }
  const body = await response.json() as {
    readonly acquires?: unknown;
  };
  if (typeof body.acquires !== 'number') {
    throw new Error(`Managed fixture count "${key}" is not numeric.`);
  }
  return body.acquires;
}

function managedArtifactUrl(key: string): string {
  return `/__cyclo_asset_pipeline__/managed/${encodeURIComponent(key)}`;
}
