import { TextEncoder } from 'node:util';

import type { AbortSignal } from '@cyclonium/abort-controller';
import type { Asset as CocosAsset } from 'cc';
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
  AudioClip,
  TTFFont,
  managedCocosAbiState,
  resetManagedCocosAbiState,
} from './fixtures/cocos-managed-abi.js';
import type {
  ArtifactSource,
  AssetRuntimeConfiguration,
} from '@/core/contracts.js';
import {
  ArtifactKind,
  type Artifact,
  type ArtifactLocation,
  type AssetCatalog,
  type AssetRecord,
} from '@/core/model.js';
import { AssetIntegrityPolicy } from '@/core/public.js';
import { assetPipeline } from '@/global.js';
import { installAssetPipelineWithConfiguration } from '@/install.js';
import {
  createWebAssetPlatformService,
} from '@/platform/web/platform.js';
import {
  COCOS_IMPORT_DECODER_ID,
  CocosAssetFinalizer,
  CocosImportDecoder,
  CocosRuntimeAbi,
  createNativeArtifactDecoderRegistry,
  createRemoteAssetLoader,
} from '@/runtime/cocos/index.js';

const SOURCE_ID = 'managed-web-native';
const artifacts = new Map<string, Uint8Array>([
  [
    'font-import',
    encodeJson({
      type: 'TTFFont',
      marker: 'web-font',
      native: '.ttf',
    }),
  ],
  ['font-native', new Uint8Array([0x00, 0x01, 0x00, 0x00])],
  [
    'audio-import',
    encodeJson({
      type: 'AudioClip',
      marker: 'web-audio',
      native: '.mp3',
    }),
  ],
  ['audio-native', new Uint8Array([0x49, 0x44, 0x33])],
]);

class MemoryWebArtifactSource implements ArtifactSource {
  readonly id = SOURCE_ID;

  acquire(
    location: ArtifactLocation,
    signal: AbortSignal,
  ): Promise<Artifact> {
    if (signal.aborted) {
      return Promise.reject(new Error('Web fixture acquire was aborted.'));
    }
    const bytes = artifacts.get(location.key);
    if (bytes === undefined) {
      return Promise.reject(new Error(
        `Web fixture artifact "${location.key}" does not exist.`,
      ));
    }
    return Promise.resolve({
      kind: ArtifactKind.bytes,
      bytes,
      format: location.format,
      sourceId: this.id,
    });
  }
}

const source = new MemoryWebArtifactSource();

beforeAll(async () => {
  const runtimeAbi = new CocosRuntimeAbi();
  const platform = createWebAssetPlatformService(undefined, runtimeAbi);
  const nativeArtifactDecoders = createNativeArtifactDecoderRegistry(
    platform.nativeArtifactDecoders,
  );
  const configuration: AssetRuntimeConfiguration = {
    catalog: createCatalog(),
    sources: [source],
    decoders: [new CocosImportDecoder(runtimeAbi, nativeArtifactDecoders)],
    finalizer: new CocosAssetFinalizer(),
    remoteAssetLoader: createRemoteAssetLoader(
      source.id,
      nativeArtifactDecoders,
    ),
    sha256: platform.sha256,
    integrityPolicy: AssetIntegrityPolicy.whenPresent,
    artifactCacheByteBudget: 0,
    artifactVariantPreference: ['web'],
    runtimeVariant: 'web-test',
  };
  await installAssetPipelineWithConfiguration(configuration);
});

beforeEach(() => {
  resetManagedCocosAbiState();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Web managed native artifacts', () => {
  it('loads and unregisters a managed TTFFont through FontFace', async () => {
    /// @case
    /// A managed TTFFont pairs a Cocos JSON import with a byte TTF artifact
    /// while the Web runtime exposes FontFace and document.fonts.
    /// @expect
    /// The Web format decoder loads and registers one family, generic Link
    /// assigns it before onLoaded, and Handle release unregisters it once.
    const add = vi.fn();
    const remove = vi.fn(() => true);
    const load = vi.fn(function loadFontFace(
      this: FakeFontFace,
    ): Promise<FakeFontFace> {
      return Promise.resolve(this);
    });
    class FakeFontFace {
      constructor(
        readonly family: string,
        readonly source: ArrayBuffer,
      ) {}

      load = load;
    }
    vi.stubGlobal('FontFace', FakeFontFace);
    vi.stubGlobal('document', {
      fonts: {
        add,
        delete: remove,
      },
    });

    const handle = assetPipeline.loadAsset<CocosAsset>('managed-web-font');
    const font = await handle.ready as unknown as TTFFont;

    expect(font).toBeInstanceOf(TTFFont);
    expect(font._nativeAsset).toBe('CycloFont_1');
    expect(load).toHaveBeenCalledOnce();
    expect(add).toHaveBeenCalledOnce();
    expect(managedCocosAbiState.onLoadedCalls.get(font._uuid)).toBe(1);

    handle.release();

    expect(remove).toHaveBeenCalledOnce();
  });

  it('loads and releases a managed MP3 AudioClip through AudioPlayer', async () => {
    /// @case
    /// A managed AudioClip pairs a Cocos JSON import with MP3 bytes on Web.
    /// @expect
    /// The Web decoder creates one Blob URL, Cocos AudioPlayer supplies native
    /// metadata, generic Link assigns it, and release revokes the URL once.
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:managed-web-audio');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL');
    const handle = assetPipeline.loadAsset<CocosAsset>('managed-web-audio');
    const audio = await handle.ready as unknown as AudioClip;

    expect(audio).toBeInstanceOf(AudioClip);
    expect(audio._nativeAsset).toMatchObject({
      duration: 1,
      type: AudioClip.AudioType.WEB_AUDIO,
      url: 'blob:managed-web-audio',
    });
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(managedCocosAbiState.audioLoads)
      .toEqual(['blob:managed-web-audio']);
    expect(managedCocosAbiState.onLoadedCalls.get(audio._uuid)).toBe(1);

    handle.release();

    expect(revokeObjectUrl).toHaveBeenCalledOnce();
  });
});

function createCatalog(): AssetCatalog {
  const records = [
    createRecord(
      'managed-web-font',
      'cc.TTFFont',
      'font-import',
      'font-native',
      'ttf',
    ),
    createRecord(
      'managed-web-audio',
      'cc.AudioClip',
      'audio-import',
      'audio-native',
      'mp3',
    ),
  ];
  return {
    revision: 'managed-web-native-v1',
    keys: new Map(records.map((record) => [
      record.resourceId,
      [record.resourceId],
    ])),
    cocosUuids: new Map(records.map((record) => [
      record.cocosUuid!,
      record.resourceId,
    ])),
    records: new Map(records.map((record) => [
      record.resourceId,
      record,
    ])),
  };
}

function createRecord(
  resourceId: string,
  runtimeTypeId: string,
  importKey: string,
  nativeKey: string,
  nativeFormat: string,
): AssetRecord {
  return {
    resourceId,
    cocosUuid: `${resourceId}-uuid`,
    runtimeTypeId,
    primaryArtifact: {
      sourceId: SOURCE_ID,
      key: importKey,
      format: 'json',
    },
    auxiliaryArtifactSets: [{
      slot: 'native',
      candidates: [{
        variant: 'web',
        location: {
          sourceId: SOURCE_ID,
          key: nativeKey,
          format: nativeFormat,
        },
      }],
    }],
    directDependencies: [],
    revision: '1',
    decoderId: COCOS_IMPORT_DECODER_ID,
  };
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}
