import { TextEncoder } from 'node:util';

import type { AbortSignal } from '@cyclonium/abort-controller';
import { invariant } from '@cyclonium/invariant';
import type {
  Asset as CocosAsset,
  Prefab as CocosPrefab,
  SceneAsset as CocosSceneAsset,
} from 'cc';
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('cc', async () => (
  import('./fixtures/cocos-managed-abi.js')
));

import {
  Asset,
  AudioClip,
  BufferAsset,
  EffectAsset,
  ImageAsset,
  JsonAsset,
  Material,
  Mesh,
  Prefab,
  SceneAsset,
  SpriteFrame,
  TTFFont,
  TextAsset,
  TextureBase,
  Texture2D,
  gfx,
  macro,
  managedCocosAbiState,
  resetManagedCocosAbiState,
} from './fixtures/cocos-managed-abi.js';
import {
  assetPipeline,
  AssetLoadError,
  AssetLoadStage,
} from '@/index.js';
import {
  installAssetPipelineWithConfiguration,
} from '@/install.js';
import type {
  ArtifactSource,
  AssetRuntimeConfiguration,
  RemoteAssetInstantiation,
  RemoteAssetLoader,
  RemoteAssetRequest,
} from '@/core/contracts.js';
import {
  ArtifactEntryKind,
  ArtifactKind,
  type Artifact,
  type ArtifactLocation,
  type AssetCatalog,
  type AssetRecord,
  type NativeBinding,
} from '@/core/model.js';
import type {
  AssetType,
  CycloAsset,
} from '@/core/public.js';
import { AssetIntegrityPolicy } from '@/core/public.js';
import {
  CocosAssetFinalizer,
} from '@/runtime/cocos/cocos-asset-finalizer.js';
import {
  COCOS_IMPORT_DECODER_ID,
  CocosImportDecoder,
} from '@/runtime/cocos/cocos-import-decoder.js';
import {
  BinaryArtifactDecoder,
  CompressedTextureArtifactDecoder,
  type NativeArtifactDecodeContext,
  type NativeArtifactDecoder,
  NativeArtifactDecoderRegistry,
} from '@/runtime/cocos/native-artifact-decoder.js';
import {
  CocosRuntimeAbi,
} from '@/runtime/cocos/cocos-runtime-abi.js';
import { sha256 } from '@/sha256/index.js';

const SOURCE_ID = 'managed-format-fixture';
const DEPENDENCY_UUID = 'fc991dd7-0033-4b80-9d41-c8a86a702e59';
const COMPRESSED_DEPENDENCY_UUID = 'fcmR3XADNLgJ1ByKhqcC5Z';
const managedBufferBacking = new Uint8Array([0xFF, 0x01, 0x02, 0x03, 0xEE]);

class MemoryArtifactSource implements ArtifactSource {
  constructor(artifacts: ReadonlyMap<string, Uint8Array>) {
    this.#artifacts = artifacts;
  }

  readonly id = SOURCE_ID;
  readonly acquireCalls = new Map<string, number>();

  acquire(
    location: ArtifactLocation,
    signal: AbortSignal,
  ): Promise<Artifact> {
    if (signal.aborted) {
      return Promise.reject(new Error('Fixture acquire was aborted.'));
    }

    const bytes = this.#artifacts.get(location.key);
    if (bytes === undefined) {
      return Promise.reject(
        new Error(`Fixture artifact "${location.key}" does not exist.`),
      );
    }

    this.acquireCalls.set(
      location.key,
      (this.acquireCalls.get(location.key) ?? 0) + 1,
    );
    return Promise.resolve({
      kind: ArtifactKind.bytes,
      bytes,
      format: location.format,
      sourceId: this.id,
    });
  }

  readonly #artifacts: ReadonlyMap<string, Uint8Array>;
}

class UnsupportedRemoteAssetLoader implements RemoteAssetLoader {
  supports<TAsset extends CycloAsset>(
    _assetType: AssetType<TAsset>,
  ): boolean {
    return false;
  }

  resolve<TAsset extends CycloAsset>(
    _request: RemoteAssetRequest<TAsset>,
  ): ArtifactLocation {
    throw new Error('Remote loading is outside this fixture.');
  }

  instantiate<TAsset extends CycloAsset>(
    _request: RemoteAssetRequest<TAsset>,
    _artifact: Artifact,
    _signal: AbortSignal,
  ): Promise<RemoteAssetInstantiation<TAsset>> {
    return Promise.reject(
      new Error('Remote loading is outside this fixture.'),
    );
  }
}

const fixtureNativeState = {
  audioSidecarReleases: 0,
  fontSidecarReleases: 0,
};

class FixtureFontArtifactDecoder implements NativeArtifactDecoder {
  readonly artifactKind = ArtifactKind.bytes;
  readonly formats = ['ttf'] as const;

  decode(
    _context: NativeArtifactDecodeContext,
    signal: AbortSignal,
  ): Promise<NativeBinding> {
    throwIfFixtureAborted(signal);
    return Promise.resolve(new FixtureFontNativeBinding());
  }
}

class FixtureFontNativeBinding implements NativeBinding {
  readonly value = 'CycloFixtureFont';

  discard(): void {
    this.#release();
  }

  release(): void {
    this.#release();
  }

  #released = false;

  #release(): void {
    invariant(!this.#released, 'Fixture font binding was already completed.');
    this.#released = true;
    fixtureNativeState.fontSidecarReleases += 1;
  }
}

class FixtureAudioArtifactDecoder implements NativeArtifactDecoder {
  readonly artifactKind = ArtifactKind.bytes;
  readonly formats = ['mp3'] as const;

  decode(
    _context: NativeArtifactDecodeContext,
    signal: AbortSignal,
  ): Promise<NativeBinding> {
    throwIfFixtureAborted(signal);
    const player = {
      destroyed: false,
      destroy(): void {
        this.destroyed = true;
      },
    };
    return Promise.resolve(new FixtureAudioNativeBinding({
      duration: 2,
      player,
      type: AudioClip.AudioType.WEB_AUDIO,
      url: 'fixture://managed-audio.mp3',
    }));
  }
}

class FixtureAudioNativeBinding implements NativeBinding {
  constructor(value: object) {
    this.value = value;
  }

  readonly value: object;

  discard(): void {
    this.#release();
  }

  release(): void {
    this.#release();
  }

  #released = false;

  #release(): void {
    invariant(!this.#released, 'Fixture audio binding was already completed.');
    this.#released = true;
    fixtureNativeState.audioSidecarReleases += 1;
  }
}

const artifactBytes = new Map<string, Uint8Array>([
  [
    'standalone-json',
    encodeJson({
      type: 'Asset',
      marker: 'standalone-json',
    }),
  ],
  [
    'packed-json',
    encodeJson([1, [], [], [], [], [[], []]]),
  ],
  [
    'runtime-type-mismatch',
    encodeJson({
      type: 'Asset',
      marker: 'runtime-type-mismatch',
    }),
  ],
  [
    'standalone-cconb',
    encodeCconb({
      type: 'Asset',
      marker: 'standalone-cconb',
    }),
  ],
  [
    'shared-binp',
    encodeBinPackV2([
      encodeCconb({
        type: 'Asset',
        marker: 'binp-entry-zero',
      }),
      encodeCconb({
        type: 'Asset',
        marker: 'binp-entry-one',
      }),
    ]),
  ],
  [
    'dependency-child',
    encodeJson({
      type: 'Asset',
      marker: 'dependency-child',
    }),
  ],
  [
    'dependency-root',
    encodeJson({
      type: 'Prefab',
      marker: 'dependency-root',
      dependencies: [{
        property: 'dependency',
        type: 'cc.Asset',
        uuid: COMPRESSED_DEPENDENCY_UUID,
      }],
    }),
  ],
  [
    'dependency-type-mismatch',
    encodeJson({
      type: 'Prefab',
      marker: 'dependency-type-mismatch',
      dependencies: [{
        property: 'dependency',
        type: 'cc.SceneAsset',
        uuid: COMPRESSED_DEPENDENCY_UUID,
      }],
    }),
  ],
  [
    'on-loaded-once',
    encodeJson({
      type: 'Asset',
      marker: 'on-loaded-once',
    }),
  ],
  [
    'scene-asset',
    encodeJson({
      type: 'SceneAsset',
      marker: 'scene-asset',
    }),
  ],
  [
    'managed-image',
    encodeJson({
      type: 'ImageAsset',
      marker: 'managed-image',
      native: '.astc',
    }),
  ],
  [
    'managed-image.astc',
    new Uint8Array([0x13, 0xAB, 0xA1, 0x5C]),
  ],
  [
    'managed-pkm-etc1',
    encodeJson({
      type: 'ImageAsset',
      marker: 'managed-pkm-etc1',
      imageNativeData: {
        fmt: `.pkm@${TextureBase.PixelFormat.RGB_ETC1}_.png@0`,
      },
    }),
  ],
  ['managed-pkm-etc1.etc1.pkm', new Uint8Array([0xE1])],
  ['managed-pkm-etc1.etc2.pkm', new Uint8Array([0xE2])],
  ['managed-pkm-etc1.png', new Uint8Array([0xF0])],
  [
    'managed-pkm-etc2',
    encodeJson({
      type: 'ImageAsset',
      marker: 'managed-pkm-etc2',
      imageNativeData: {
        fmt: `.pkm@${TextureBase.PixelFormat.RGBA_ETC2}_.png@0`,
      },
    }),
  ],
  ['managed-pkm-etc2.etc1.pkm', new Uint8Array([0xE1])],
  ['managed-pkm-etc2.etc2.pkm', new Uint8Array([0xE2])],
  ['managed-pkm-etc2.png', new Uint8Array([0xF0])],
  [
    'managed-macro-order',
    encodeJson({
      type: 'ImageAsset',
      marker: 'managed-macro-order',
      imageNativeData: {
        fmt: `.astc@0_.pkm@${TextureBase.PixelFormat.RGB_ETC2}_.png@0`,
      },
    }),
  ],
  ['managed-macro-order.astc', new Uint8Array([0xA5])],
  ['managed-macro-order.pkm', new Uint8Array([0xE2])],
  ['managed-macro-order.png', new Uint8Array([0xF0])],
  [
    'managed-buffer',
    encodeJson({
      type: 'BufferAsset',
      marker: 'managed-buffer',
      native: '.bin',
    }),
  ],
  [
    'managed-buffer.bin',
    new Uint8Array(managedBufferBacking.buffer, 1, 3),
  ],
  [
    'managed-json-asset',
    encodeJson({
      type: 'JsonAsset',
      marker: 'managed-json-asset',
      json: {
        answer: 42,
      },
    }),
  ],
  [
    'managed-text-asset',
    encodeJson({
      type: 'TextAsset',
      marker: 'managed-text-asset',
      text: 'hello from managed text',
    }),
  ],
  [
    'managed-mesh',
    encodeJson({
      type: 'Mesh',
      marker: 'managed-mesh',
      native: '.bin',
    }),
  ],
  [
    'managed-mesh.bin',
    new Uint8Array([0x10, 0x20, 0x30]),
  ],
  [
    'managed-font',
    encodeJson({
      type: 'TTFFont',
      marker: 'managed-font',
      native: '.ttf',
    }),
  ],
  [
    'managed-font.ttf',
    new Uint8Array([0x00, 0x01, 0x00, 0x00]),
  ],
  [
    'managed-audio',
    encodeJson({
      audioLoadMode: AudioClip.AudioType.WEB_AUDIO,
      type: 'AudioClip',
      marker: 'managed-audio',
      native: '.mp3',
    }),
  ],
  [
    'managed-audio.mp3',
    new Uint8Array([0x49, 0x44, 0x33]),
  ],
  [
    'matrix-image',
    encodeJson({
      type: 'ImageAsset',
      marker: 'matrix-image',
    }),
  ],
  [
    'matrix-texture',
    encodeJson({
      type: 'Texture2D',
      marker: 'matrix-texture',
      dependencies: [{
        property: 'image',
        type: 'cc.ImageAsset',
        uuid: 'matrix-image-uuid',
      }],
    }),
  ],
  [
    'matrix-sprite-frame',
    encodeJson({
      type: 'SpriteFrame',
      marker: 'matrix-sprite-frame',
      dependencies: [{
        property: 'texture',
        type: 'cc.Texture2D',
        uuid: 'matrix-texture-uuid',
      }],
    }),
  ],
  [
    'matrix-effect',
    encodeJson({
      type: 'EffectAsset',
      marker: 'matrix-effect',
    }),
  ],
  [
    'matrix-material',
    encodeJson({
      type: 'Material',
      marker: 'matrix-material',
      dependencies: [{
        property: 'effectAsset',
        type: 'cc.EffectAsset',
        uuid: 'matrix-effect-uuid',
      }],
    }),
  ],
  [
    'matrix-prefab',
    encodeJson({
      type: 'Prefab',
      marker: 'matrix-prefab',
      dependencies: [
        {
          property: 'spriteFrame',
          type: 'cc.SpriteFrame',
          uuid: 'matrix-sprite-frame-uuid',
        },
        {
          property: 'material',
          type: 'cc.Material',
          uuid: 'matrix-material-uuid',
        },
      ],
    }),
  ],
  [
    'matrix-scene',
    encodeJson({
      type: 'SceneAsset',
      marker: 'matrix-scene',
      dependencies: [{
        property: 'prefab',
        type: 'cc.Prefab',
        uuid: 'matrix-prefab-uuid',
      }],
    }),
  ],
  [
    'decode-failure',
    encodeJson({
      type: 'Asset',
      marker: 'decode-failure',
    }),
  ],
  [
    'finalize-failure',
    encodeJson({
      type: 'Asset',
      marker: 'finalize-failure',
    }),
  ],
]);

const source = new MemoryArtifactSource(artifactBytes);

beforeAll(async () => {
  const runtimeAbi = new CocosRuntimeAbi();
  const nativeArtifactDecoders = new NativeArtifactDecoderRegistry([
    new BinaryArtifactDecoder(),
    new CompressedTextureArtifactDecoder(),
    new FixtureFontArtifactDecoder(),
    new FixtureAudioArtifactDecoder(),
  ]);
  const configuration: AssetRuntimeConfiguration = {
    catalog: createCatalog(),
    sources: [source],
    decoders: [new CocosImportDecoder(runtimeAbi, nativeArtifactDecoders)],
    finalizer: new CocosAssetFinalizer(),
    remoteAssetLoader: new UnsupportedRemoteAssetLoader(),
    sha256,
    integrityPolicy: AssetIntegrityPolicy.whenPresent,
    artifactCacheByteBudget: 1024 * 1024,
  };
  await installAssetPipelineWithConfiguration(configuration);
});

beforeEach(() => {
  resetManagedCocosAbiState();
  fixtureNativeState.audioSidecarReleases = 0;
  fixtureNativeState.fontSidecarReleases = 0;
});

describe('Cocos managed artifact formats', () => {
  it('loads a standalone JSON import artifact', async () => {
    /// @case
    /// A Catalog record points at a standalone UTF-8 Cocos JSON artifact.
    /// @expect
    /// Public loadAsset returns the deserialized Asset after one Finalize.
    const handle = assetPipeline.loadAsset<CocosAsset>('standalone-json');
    const asset = asFixtureAsset(await handle.ready);

    expect(asset.marker).toBe('standalone-json');
    expect(managedCocosAbiState.onLoadedCalls.get(asset._uuid)).toBe(1);

    handle.release();
  });

  it('rejects a packed JSON artifact without publishing a shell', async () => {
    /// @case
    /// A Catalog record points at Cocos packed JSON, which is outside v1.
    /// @expect
    /// loadAsset fails in Decode with an explicit unsupported-format cause,
    /// and no Asset reaches deserialization or Finalize.
    const handle = assetPipeline.loadAsset<CocosAsset>('packed-json');
    const error = await rejectionOf(handle.ready);

    expect(error).toBeInstanceOf(AssetLoadError);
    expect((error as AssetLoadError).stage).toBe(AssetLoadStage.decode);
    expect((error as AssetLoadError).cause).toMatchObject({
      message: expect.stringContaining('packed JSON'),
    });
    expect(managedCocosAbiState.createdAssets).toHaveLength(0);
    expect(managedCocosAbiState.onLoadedCalls.size).toBe(0);
  });

  it('rejects a runtime asset that does not match its Catalog type', async () => {
    /// @case
    /// A Catalog record promises SceneAsset but its import artifact creates a
    /// plain Asset.
    /// @expect
    /// Decode fails before publication and the mismatched runtime shell is
    /// destroyed.
    const handle = assetPipeline.loadAsset<CocosAsset>(
      'runtime-type-mismatch',
    );
    const error = await rejectionOf(handle.ready);

    expect(error).toBeInstanceOf(AssetLoadError);
    expect((error as AssetLoadError).stage).toBe(AssetLoadStage.decode);
    expect(managedCocosAbiState.createdAssets).toHaveLength(1);
    expect(managedCocosAbiState.createdAssets[0]?.destroyed).toBe(true);
    expect(managedCocosAbiState.onLoadedCalls.size).toBe(0);
  });

  it('loads a standalone CCONB import artifact', async () => {
    /// @case
    /// A Catalog record points at a version-2 standalone CCONB container.
    /// @expect
    /// The private decoder ABI returns its CCON object to cc.deserialize and
    /// public loadAsset publishes the reconstructed Asset.
    const handle = assetPipeline.loadAsset<CocosAsset>('standalone-cconb');
    const asset = asFixtureAsset(await handle.ready);

    expect(asset.marker).toBe('standalone-cconb');
    expect(managedCocosAbiState.deserializeCalls).toBe(1);
    expect(managedCocosAbiState.onLoadedCalls.get(asset._uuid)).toBe(1);

    handle.release();
  });

  it('loads two BINP-v2 entries from one acquired artifact', async () => {
    /// @case
    /// Two Catalog records select different CCONB entries in one BINP-v2 file.
    /// @expect
    /// Both Assets load with their own content while the shared byte artifact
    /// is acquired only once.
    const entryZero = assetPipeline.loadAsset<CocosAsset>('binp-entry-zero');
    const entryOne = assetPipeline.loadAsset<CocosAsset>('binp-entry-one');
    const [zeroResult, oneResult] = await Promise.all([
      entryZero.ready,
      entryOne.ready,
    ]);
    const zeroAsset = asFixtureAsset(zeroResult);
    const oneAsset = asFixtureAsset(oneResult);

    expect(zeroAsset.marker).toBe('binp-entry-zero');
    expect(oneAsset.marker).toBe('binp-entry-one');
    expect(source.acquireCalls.get('shared-binp')).toBe(1);

    entryZero.release();
    entryOne.release();
  });

  it('links a compressed UUID dependency collected by Details', async () => {
    /// @case
    /// A Prefab Details slot refers to a dependency using Cocos compressed UUID.
    /// @expect
    /// The UUID is expanded, resolved through the internal UUID Catalog index,
    /// and the dependency Asset is injected into the recorded owner property.
    const handle = assetPipeline.loadAsset<CocosPrefab>('dependency-root');
    const prefab = await handle.ready as unknown as Prefab;

    expect(prefab.dependency).toBeInstanceOf(Asset);
    expect(prefab.dependency?.marker).toBe('dependency-child');
    expect(prefab.dependency?._uuid).toBe(DEPENDENCY_UUID);

    handle.release();
  });

  it('rejects a dependency that does not match its serialized type', async () => {
    /// @case
    /// A Prefab dependency slot requires SceneAsset but its internal UUID
    /// resolves to a plain Asset.
    /// @expect
    /// Link fails before Finalize and both newly decoded shells are destroyed.
    const handle = assetPipeline.loadAsset<CocosAsset>(
      'dependency-type-mismatch',
    );
    const error = await rejectionOf(handle.ready);

    expect(error).toBeInstanceOf(AssetLoadError);
    expect((error as AssetLoadError).stage).toBe(AssetLoadStage.link);
    expect(managedCocosAbiState.createdAssets).toHaveLength(2);
    expect(
      managedCocosAbiState.createdAssets.every((asset) => asset.destroyed),
    ).toBe(true);
    expect(managedCocosAbiState.onLoadedCalls.size).toBe(0);
  });

  it('invokes onLoaded once for a cached managed Asset', async () => {
    /// @case
    /// Two successive public loads retain the same ready managed resource.
    /// @expect
    /// Both Handles observe one runtime Asset and onLoaded executes once.
    const firstHandle = assetPipeline.loadAsset<CocosAsset>('on-loaded-once');
    const firstAsset = asFixtureAsset(await firstHandle.ready);
    const secondHandle = assetPipeline.loadAsset<CocosAsset>('on-loaded-once');
    const secondAsset = asFixtureAsset(await secondHandle.ready);

    expect(secondAsset).toBe(firstAsset);
    expect(
      managedCocosAbiState.onLoadedCalls.get(firstAsset._uuid),
    ).toBe(1);

    firstHandle.release();
    secondHandle.release();
  });

  it('delivers SceneAsset without changing the active scene', async () => {
    /// @case
    /// A caller loads a managed SceneAsset through the public asset API.
    /// @expect
    /// The SceneAsset is delivered and no Director scene transition is invoked.
    const handle = assetPipeline.loadAsset<CocosSceneAsset>('scene-asset');
    const scene = await handle.ready as unknown as SceneAsset;

    expect(scene).toBeInstanceOf(SceneAsset);
    expect(scene.marker).toBe('scene-asset');
    expect(managedCocosAbiState.sceneSwitchCalls).toBe(0);

    handle.release();
  });

  it('links every formally supported managed asset type', async () => {
    /// @case
    /// One Scene dependency graph contains Prefab, SpriteFrame, Texture2D,
    /// ImageAsset, Material, and EffectAsset records connected by UUID slots.
    /// @expect
    /// The generic Cocos ABI path creates the declared runtime classes, links
    /// every typed dependency, and finalizes each Asset exactly once.
    const handle = assetPipeline.loadAsset<CocosSceneAsset>('matrix-scene');
    const scene = await handle.ready as unknown as SceneAsset;

    expect(scene).toBeInstanceOf(SceneAsset);
    expect(scene.prefab).toBeInstanceOf(Prefab);
    expect(scene.prefab?.spriteFrame).toBeInstanceOf(SpriteFrame);
    expect(scene.prefab?.spriteFrame?.texture).toBeInstanceOf(Texture2D);
    expect(scene.prefab?.spriteFrame?.texture?.image).toBeInstanceOf(ImageAsset);
    expect(scene.prefab?.material).toBeInstanceOf(Material);
    expect(scene.prefab?.material?.effectAsset).toBeInstanceOf(EffectAsset);
    for (const uuid of [
      'matrix-image-uuid',
      'matrix-texture-uuid',
      'matrix-sprite-frame-uuid',
      'matrix-effect-uuid',
      'matrix-material-uuid',
      'matrix-prefab-uuid',
      'matrix-scene-uuid',
    ]) {
      expect(managedCocosAbiState.onLoadedCalls.get(uuid)).toBe(1);
    }

    handle.release();
  });

  it('binds a managed compressed texture from byte artifacts', async () => {
    /// @case
    /// A managed ImageAsset declares an ASTC native artifact that is acquired
    /// as bytes instead of a browser or mini-game image file.
    /// @expect
    /// The version-locked Cocos compressed texture parser feeds ImageAsset
    /// before its single onLoaded call.
    const handle = assetPipeline.loadAsset<CocosAsset>('managed-image');
    const image = await handle.ready as unknown as ImageAsset;

    expect(image).toBeInstanceOf(ImageAsset);
    expect(image._nativeAsset).toMatchObject({
      compressionType: 2,
    });
    expect(managedCocosAbiState.onLoadedCalls.get(image._uuid)).toBe(1);

    handle.release();
  });

  /// @case
  /// The device supports ETC1 and ETC2, while serialized ImageAsset data
  /// selects the ETC1 PixelFormat for its shared .pkm extension.
  /// @expect
  /// Only the pkm-etc1 candidate is acquired and linked; pkm-etc2 is not
  /// chosen merely because the same device also supports ETC2.
  it('selects the ETC1 PKM candidate chosen by ImageAsset deserialization', async () => {
    macro.SUPPORT_TEXTURE_FORMATS.splice(
      0,
      macro.SUPPORT_TEXTURE_FORMATS.length,
      '.pkm',
      '.png',
    );
    managedCocosAbiState.sampledTextureFormats.add(gfx.Format.ETC_RGB8);
    managedCocosAbiState.sampledTextureFormats.add(gfx.Format.ETC2_RGB8);

    const handle = assetPipeline.loadAsset<CocosAsset>('managed-pkm-etc1');
    const image = await handle.ready as unknown as ImageAsset;

    expect(image._native).toBe('.pkm');
    expect(image.format).toBe(TextureBase.PixelFormat.RGB_ETC1);
    expect(image._nativeAsset).toMatchObject({
      bytes: new Uint8Array([0xE1]),
    });
    expect(source.acquireCalls.get('managed-pkm-etc1.etc1.pkm')).toBe(1);
    expect(source.acquireCalls.has('managed-pkm-etc1.etc2.pkm')).toBe(false);
    expect(source.acquireCalls.has('managed-pkm-etc1.png')).toBe(false);

    handle.release();
  });

  /// @case
  /// The device supports ETC1 and ETC2, while serialized ImageAsset data
  /// selects the ETC2 PixelFormat for its shared .pkm extension.
  /// @expect
  /// Only the pkm-etc2 candidate is acquired and linked.
  it('selects the ETC2 PKM candidate chosen by ImageAsset deserialization', async () => {
    macro.SUPPORT_TEXTURE_FORMATS.splice(
      0,
      macro.SUPPORT_TEXTURE_FORMATS.length,
      '.pkm',
      '.png',
    );
    managedCocosAbiState.sampledTextureFormats.add(gfx.Format.ETC_RGB8);
    managedCocosAbiState.sampledTextureFormats.add(gfx.Format.ETC2_RGB8);

    const handle = assetPipeline.loadAsset<CocosAsset>('managed-pkm-etc2');
    const image = await handle.ready as unknown as ImageAsset;

    expect(image._native).toBe('.pkm');
    expect(image.format).toBe(TextureBase.PixelFormat.RGBA_ETC2);
    expect(image._nativeAsset).toMatchObject({
      bytes: new Uint8Array([0xE2]),
    });
    expect(source.acquireCalls.get('managed-pkm-etc2.etc2.pkm')).toBe(1);
    expect(source.acquireCalls.has('managed-pkm-etc2.etc1.pkm')).toBe(false);
    expect(source.acquireCalls.has('managed-pkm-etc2.png')).toBe(false);

    handle.release();
  });

  /// @case
  /// Serialized ImageAsset data lists ASTC before PKM, but the runtime macro
  /// orders PKM before ASTC and the device supports both formats.
  /// @expect
  /// ImageAsset deserialization selects PKM and Cyclo acquires that exact
  /// candidate instead of following serialized or Catalog candidate order.
  it('follows Cocos macro order after primary deserialization', async () => {
    macro.SUPPORT_TEXTURE_FORMATS.splice(
      0,
      macro.SUPPORT_TEXTURE_FORMATS.length,
      '.pkm',
      '.astc',
      '.png',
    );
    managedCocosAbiState.sampledTextureFormats.add(gfx.Format.ETC2_RGB8);
    managedCocosAbiState.sampledTextureFormats.add(gfx.Format.ASTC_RGBA_4X4);

    const handle = assetPipeline.loadAsset<CocosAsset>(
      'managed-macro-order',
    );
    const image = await handle.ready as unknown as ImageAsset;

    expect(image._native).toBe('.pkm');
    expect(image._nativeAsset).toMatchObject({
      bytes: new Uint8Array([0xE2]),
    });
    expect(source.acquireCalls.get('managed-macro-order.pkm')).toBe(1);
    expect(source.acquireCalls.has('managed-macro-order.astc')).toBe(false);
    expect(source.acquireCalls.has('managed-macro-order.png')).toBe(false);

    handle.release();
  });

  it('links a binary native artifact without an Asset-specific binder', async () => {
    /// @case
    /// A managed BufferAsset declares a BIN native artifact backed by a
    /// Uint8Array view whose ArrayBuffer contains unrelated prefix and suffix.
    /// @expect
    /// Public loadAsset links only the declared byte range through the generic
    /// native path before onLoaded, without requiring a BufferAsset handler.
    const handle = assetPipeline.loadAsset<CocosAsset>('managed-buffer');
    const buffer = await handle.ready as unknown as BufferAsset;

    expect(buffer).toBeInstanceOf(BufferAsset);
    expect([...new Uint8Array(buffer.buffer())]).toEqual([0x01, 0x02, 0x03]);
    expect(managedCocosAbiState.onLoadedCalls.get(buffer._uuid)).toBe(1);

    handle.release();
  });

  it('deserializes JsonAsset and TextAsset without native handlers', async () => {
    /// @case
    /// JsonAsset and TextAsset Catalog records contain all runtime data in
    /// their Cocos JSON import artifacts and declare no native payload.
    /// @expect
    /// The generic import decoder creates both concrete classes, preserves
    /// their serialized values, and finalizes each Asset exactly once.
    const jsonHandle = assetPipeline.loadAsset<CocosAsset>(
      'managed-json-asset',
    );
    const textHandle = assetPipeline.loadAsset<CocosAsset>(
      'managed-text-asset',
    );
    const [json, text] = await Promise.all([
      jsonHandle.ready,
      textHandle.ready,
    ]) as unknown as [JsonAsset, TextAsset];

    expect(json).toBeInstanceOf(JsonAsset);
    expect(json.json).toEqual({ answer: 42 });
    expect(text).toBeInstanceOf(TextAsset);
    expect(text.text).toBe('hello from managed text');
    expect(managedCocosAbiState.onLoadedCalls.get(json._uuid)).toBe(1);
    expect(managedCocosAbiState.onLoadedCalls.get(text._uuid)).toBe(1);

    jsonHandle.release();
    textHandle.release();
  });

  it('links Mesh through the same binary format decoder as BufferAsset', async () => {
    /// @case
    /// A Mesh import artifact declares a BIN native payload, just like the
    /// managed BufferAsset fixture.
    /// @expect
    /// Physical format routing yields an ArrayBuffer and generic Link assigns
    /// it without registering a Mesh-specific pipeline handler.
    const handle = assetPipeline.loadAsset<CocosAsset>('managed-mesh');
    const mesh = await handle.ready as unknown as Mesh;

    expect(mesh).toBeInstanceOf(Mesh);
    expect(mesh._nativeAsset).toBeInstanceOf(ArrayBuffer);
    expect([...new Uint8Array(mesh._nativeAsset as ArrayBuffer)])
      .toEqual([0x10, 0x20, 0x30]);
    expect(managedCocosAbiState.onLoadedCalls.get(mesh._uuid)).toBe(1);

    handle.release();
  });

  it('links platform font and MP3 values before Finalize', async () => {
    /// @case
    /// Managed TTFFont and AudioClip records pair Cocos JSON imports with TTF
    /// and MP3 native artifacts decoded by format-only platform handlers.
    /// @expect
    /// Link assigns both native values before onLoaded; releasing the Handles
    /// destroys the Assets and releases each decoder-owned sidecar once.
    const fontHandle = assetPipeline.loadAsset<CocosAsset>('managed-font');
    const audioHandle = assetPipeline.loadAsset<CocosAsset>('managed-audio');
    const [font, audio] = await Promise.all([
      fontHandle.ready,
      audioHandle.ready,
    ]) as unknown as [TTFFont, AudioClip];

    expect(font).toBeInstanceOf(TTFFont);
    expect(font._nativeAsset).toBe('CycloFixtureFont');
    expect(audio).toBeInstanceOf(AudioClip);
    expect(audio._nativeAsset).toMatchObject({
      duration: 2,
      type: AudioClip.AudioType.WEB_AUDIO,
    });
    expect(managedCocosAbiState.onLoadedCalls.get(font._uuid)).toBe(1);
    expect(managedCocosAbiState.onLoadedCalls.get(audio._uuid)).toBe(1);

    fontHandle.release();
    audioHandle.release();

    expect(fixtureNativeState.fontSidecarReleases).toBe(1);
    expect(fixtureNativeState.audioSidecarReleases).toBe(1);
  });

  it('does not publish a partially decoded Asset', async () => {
    /// @case
    /// cc.deserialize fails once and the same Catalog key is loaded again.
    /// @expect
    /// The first operation fails in Decode, while the retry performs a fresh
    /// deserialize and publishes exactly one finalized Asset.
    managedCocosAbiState.decodeFailuresRemaining.set(
      'decode-failure',
      1,
    );

    const failedHandle = assetPipeline.loadAsset<CocosAsset>(
      'decode-failure',
    );
    const error = await rejectionOf(failedHandle.ready);
    expect(error).toBeInstanceOf(AssetLoadError);
    expect((error as AssetLoadError).stage).toBe(AssetLoadStage.decode);
    expect(managedCocosAbiState.createdAssets).toHaveLength(0);

    const retryHandle = assetPipeline.loadAsset<CocosAsset>(
      'decode-failure',
    );
    const retryAsset = asFixtureAsset(await retryHandle.ready);
    expect(retryAsset.marker).toBe('decode-failure');
    expect(managedCocosAbiState.deserializeCalls).toBe(2);
    expect(
      managedCocosAbiState.onLoadedCalls.get(retryAsset._uuid),
    ).toBe(1);

    retryHandle.release();
  });

  it('destroys a Finalize failure instead of publishing it', async () => {
    /// @case
    /// onLoaded fails once and the same Catalog key is loaded again.
    /// @expect
    /// The failed shell is destroyed and a newly deserialized Asset is
    /// finalized and published by the retry.
    managedCocosAbiState.finalizeFailuresRemaining.set(
      'finalize-failure-uuid',
      1,
    );

    const failedHandle = assetPipeline.loadAsset<CocosAsset>(
      'finalize-failure',
    );
    const error = await rejectionOf(failedHandle.ready);
    expect(error).toBeInstanceOf(AssetLoadError);
    expect((error as AssetLoadError).stage).toBe(AssetLoadStage.finalize);
    expect(managedCocosAbiState.createdAssets).toHaveLength(1);
    const failedAsset = managedCocosAbiState.createdAssets[0];
    expect(failedAsset?.destroyed).toBe(true);

    const retryHandle = assetPipeline.loadAsset<CocosAsset>(
      'finalize-failure',
    );
    const retryAsset = asFixtureAsset(await retryHandle.ready);
    expect(retryAsset).not.toBe(failedAsset);
    expect(retryAsset.marker).toBe('finalize-failure');
    expect(managedCocosAbiState.createdAssets).toHaveLength(2);

    retryHandle.release();
  });
});

function createCatalog(): AssetCatalog {
  const records = [
    createRecord('standalone-json', 'json'),
    createRecord('packed-json', 'json'),
    createRecord('runtime-type-mismatch', 'json', {
      runtimeTypeId: 'cc.SceneAsset',
    }),
    createRecord('standalone-cconb', 'cconb'),
    createRecord('dependency-child', 'json', {
      cocosUuid: DEPENDENCY_UUID,
    }),
    createRecord('dependency-root', 'json', {
      cocosUuid: 'dependency-root-uuid',
      directDependencies: [],
    }),
    createRecord('dependency-type-mismatch', 'json', {
      cocosUuid: 'dependency-type-mismatch-uuid',
      directDependencies: [],
      runtimeTypeId: 'cc.Prefab',
    }),
    createRecord('on-loaded-once', 'json', {
      cocosUuid: 'on-loaded-once-uuid',
    }),
    createRecord('scene-asset', 'json', {
      cocosUuid: 'scene-asset-uuid',
      runtimeTypeId: 'cc.SceneAsset',
    }),
    createRecord('managed-image', 'json', {
      auxiliaryArtifact: {
        key: 'managed-image.astc',
        format: 'astc',
      },
      cocosUuid: 'managed-image-uuid',
      runtimeTypeId: 'cc.ImageAsset',
    }),
    createRecord('managed-pkm-etc1', 'json', {
      auxiliaryArtifacts: [
        {
          key: 'managed-pkm-etc1.etc2.pkm',
          format: 'pkm',
          variant: 'pkm-etc2',
        },
        {
          key: 'managed-pkm-etc1.png',
          format: 'png',
        },
        {
          key: 'managed-pkm-etc1.etc1.pkm',
          format: 'pkm',
          variant: 'pkm-etc1',
        },
      ],
      runtimeTypeId: 'cc.ImageAsset',
    }),
    createRecord('managed-pkm-etc2', 'json', {
      auxiliaryArtifacts: [
        {
          key: 'managed-pkm-etc2.etc1.pkm',
          format: 'pkm',
          variant: 'pkm-etc1',
        },
        {
          key: 'managed-pkm-etc2.png',
          format: 'png',
        },
        {
          key: 'managed-pkm-etc2.etc2.pkm',
          format: 'pkm',
          variant: 'pkm-etc2',
        },
      ],
      runtimeTypeId: 'cc.ImageAsset',
    }),
    createRecord('managed-macro-order', 'json', {
      auxiliaryArtifacts: [
        {
          key: 'managed-macro-order.astc',
          format: 'astc',
          variant: 'astc',
        },
        {
          key: 'managed-macro-order.pkm',
          format: 'pkm',
          variant: 'pkm-etc2',
        },
        {
          key: 'managed-macro-order.png',
          format: 'png',
        },
      ],
      runtimeTypeId: 'cc.ImageAsset',
    }),
    createRecord('managed-buffer', 'json', {
      auxiliaryArtifact: {
        key: 'managed-buffer.bin',
        format: 'bin',
      },
      cocosUuid: 'managed-buffer-uuid',
      runtimeTypeId: 'cc.BufferAsset',
    }),
    createRecord('managed-json-asset', 'json', {
      runtimeTypeId: 'cc.JsonAsset',
    }),
    createRecord('managed-text-asset', 'json', {
      runtimeTypeId: 'cc.TextAsset',
    }),
    createRecord('managed-mesh', 'json', {
      auxiliaryArtifact: {
        key: 'managed-mesh.bin',
        format: 'bin',
      },
      runtimeTypeId: 'cc.Mesh',
    }),
    createRecord('managed-font', 'json', {
      auxiliaryArtifact: {
        key: 'managed-font.ttf',
        format: 'ttf',
      },
      runtimeTypeId: 'cc.TTFFont',
    }),
    createRecord('managed-audio', 'json', {
      auxiliaryArtifact: {
        key: 'managed-audio.mp3',
        format: 'mp3',
      },
      runtimeTypeId: 'cc.AudioClip',
    }),
    createRecord('matrix-image', 'json', {
      cocosUuid: 'matrix-image-uuid',
      runtimeTypeId: 'cc.ImageAsset',
    }),
    createRecord('matrix-texture', 'json', {
      cocosUuid: 'matrix-texture-uuid',
      runtimeTypeId: 'cc.Texture2D',
    }),
    createRecord('matrix-sprite-frame', 'json', {
      cocosUuid: 'matrix-sprite-frame-uuid',
      runtimeTypeId: 'cc.SpriteFrame',
    }),
    createRecord('matrix-effect', 'json', {
      cocosUuid: 'matrix-effect-uuid',
      runtimeTypeId: 'cc.EffectAsset',
    }),
    createRecord('matrix-material', 'json', {
      cocosUuid: 'matrix-material-uuid',
      runtimeTypeId: 'cc.Material',
    }),
    createRecord('matrix-prefab', 'json', {
      cocosUuid: 'matrix-prefab-uuid',
      runtimeTypeId: 'cc.Prefab',
    }),
    createRecord('matrix-scene', 'json', {
      cocosUuid: 'matrix-scene-uuid',
      runtimeTypeId: 'cc.SceneAsset',
    }),
    createRecord('decode-failure', 'json', {
      cocosUuid: 'decode-failure-uuid',
    }),
    createRecord('finalize-failure', 'json', {
      cocosUuid: 'finalize-failure-uuid',
    }),
    createRecord('binp-entry-zero', 'bin', {
      artifactKey: 'shared-binp',
      cocosUuid: 'binp-entry-zero-uuid',
      entryIndex: 0,
    }),
    createRecord('binp-entry-one', 'bin', {
      artifactKey: 'shared-binp',
      cocosUuid: 'binp-entry-one-uuid',
      entryIndex: 1,
    }),
  ];

  return {
    revision: 'managed-format-fixture',
    keys: new Map(records.map((record) => [
      record.resourceId,
      [record.resourceId],
    ])),
    cocosUuids: new Map(records.flatMap((record) => (
      record.cocosUuid === undefined
        ? []
        : [[record.cocosUuid, record.resourceId]]
    ))),
    records: new Map(records.map((record) => [
      record.resourceId,
      record,
    ])),
  };
}

interface RecordOverrides {
  readonly artifactKey?: string;
  readonly auxiliaryArtifact?: AuxiliaryArtifactOverride;
  readonly auxiliaryArtifacts?: readonly AuxiliaryArtifactOverride[];
  readonly cocosUuid?: string;
  readonly directDependencies?: readonly string[];
  readonly entryIndex?: number;
  readonly runtimeTypeId?: string;
}

interface AuxiliaryArtifactOverride {
  readonly format: string;
  readonly key: string;
  readonly variant?: string;
}

function createRecord(
  resourceId: string,
  format: string,
  overrides: RecordOverrides = {},
): AssetRecord {
  const auxiliaryArtifacts = overrides.auxiliaryArtifacts
    ?? (
      overrides.auxiliaryArtifact === undefined
        ? []
        : [overrides.auxiliaryArtifact]
    );
  return {
    resourceId,
    cocosUuid: overrides.cocosUuid ?? `${resourceId}-uuid`,
    runtimeTypeId: overrides.runtimeTypeId ?? 'cc.Asset',
    primaryArtifact: {
      sourceId: SOURCE_ID,
      key: overrides.artifactKey ?? resourceId,
      format,
      entry: overrides.entryIndex === undefined
        ? undefined
        : {
          kind: ArtifactEntryKind.binPackV2,
          index: overrides.entryIndex,
        },
    },
    auxiliaryArtifactSets: auxiliaryArtifacts.length === 0
      ? []
      : [{
        slot: 'native',
        candidates: auxiliaryArtifacts.map((artifact) => ({
          variant: artifact.variant,
          location: {
            sourceId: SOURCE_ID,
            key: artifact.key,
            format: artifact.format,
          },
        })),
      }],
    directDependencies: overrides.directDependencies ?? [],
    revision: '1',
    decoderId: COCOS_IMPORT_DECODER_ID,
  };
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function encodeCconb(document: unknown): Uint8Array {
  const documentBytes = encodeJson(document);
  const bytes = new Uint8Array(16 + documentBytes.byteLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x4E4F4343, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.byteLength, true);
  view.setUint32(12, documentBytes.byteLength, true);
  bytes.set(documentBytes, 16);
  return bytes;
}

function encodeBinPackV2(entries: readonly Uint8Array[]): Uint8Array {
  const tableByteLength = 4 * (3 + entries.length * 2);
  const entriesByteLength = entries.reduce(
    (total, entry) => total + entry.byteLength,
    0,
  );
  const bytes = new Uint8Array(tableByteLength + entriesByteLength);
  bytes.set(new TextEncoder().encode('BINP'), 0);

  const view = new DataView(bytes.buffer);
  view.setUint32(4, 2, true);
  view.setUint32(8, entries.length, true);

  let relativeOffset = 0;
  entries.forEach((entry, index) => {
    const tableOffset = 4 * (3 + index * 2);
    view.setUint32(tableOffset, relativeOffset, true);
    view.setUint32(tableOffset + 4, entry.byteLength, true);
    bytes.set(entry, tableByteLength + relativeOffset);
    relativeOffset += entry.byteLength;
  });
  return bytes;
}

async function rejectionOf(
  promise: Promise<unknown>,
): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the Promise to reject.');
}

function asFixtureAsset(asset: CocosAsset): Asset {
  return asset as unknown as Asset;
}

function throwIfFixtureAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new Error('Fixture native artifact decoding was aborted.');
  }
}
