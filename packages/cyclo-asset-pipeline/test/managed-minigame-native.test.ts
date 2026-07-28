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
import type { AssetRuntimeConfiguration } from '@/core/contracts.js';
import type {
  AssetCatalog,
  AssetRecord,
} from '@/core/model.js';
import { ArtifactKind } from '@/core/model.js';
import { AssetIntegrityPolicy } from '@/core/public.js';
import { assetPipeline } from '@/global.js';
import { installAssetPipelineWithConfiguration } from '@/install.js';
import {
  createMinigameAssetPlatformService,
  MinigameArtifactSource,
} from '@/platform/minigame-shared/index.js';
import type {
  MinigameByteResponse,
  MinigameDownloadedFile,
  MinigamePlatformAdapter,
} from '@/platform/minigame-shared/minigame-platform-adapter.js';
import {
  COCOS_IMPORT_DECODER_ID,
  CocosAssetFinalizer,
  CocosImportDecoder,
  CocosRuntimeAbi,
  createNativeArtifactDecoderRegistry,
  createRemoteAssetLoader,
} from '@/runtime/cocos/index.js';

const importArtifacts = new Map<string, Uint8Array>([
  [
    '/package/font.json',
    encodeJson({
      type: 'TTFFont',
      marker: 'minigame-font',
      native: '.ttf',
    }),
  ],
  [
    '/package/audio.json',
    encodeJson({
      type: 'AudioClip',
      marker: 'minigame-audio',
      native: '.mp3',
    }),
  ],
]);

class FixtureMinigamePlatformAdapter implements MinigamePlatformAdapter {
  readonly id = 'wechat';
  readonly fontPaths: string[] = [];
  readonly readPaths: string[] = [];

  requestBytes(
    _url: string,
    _signal: AbortSignal,
  ): Promise<MinigameByteResponse> {
    return Promise.reject(new Error('HTTP is outside this fixture.'));
  }

  readFileBytes(
    path: string,
    signal: AbortSignal,
  ): Promise<Uint8Array> {
    if (signal.aborted) {
      return Promise.reject(new Error('Mini-game fixture read was aborted.'));
    }
    const bytes = importArtifacts.get(path);
    if (bytes === undefined) {
      return Promise.reject(new Error(
        `Mini-game fixture file "${path}" does not exist.`,
      ));
    }
    this.readPaths.push(path);
    return Promise.resolve(bytes);
  }

  downloadFile(
    _url: string,
    _signal: AbortSignal,
  ): Promise<MinigameDownloadedFile> {
    return Promise.reject(new Error('Downloads are outside this fixture.'));
  }

  createImage(
    _path: string,
    _signal: AbortSignal,
  ): Promise<object> {
    return Promise.reject(new Error('Images are outside this fixture.'));
  }

  loadFont(path: string): string {
    this.fontPaths.push(path);
    return 'CycloMinigameFixtureFont';
  }

  removeFile(_path: string): Promise<void> {
    return Promise.resolve();
  }
}

const platformAdapter = new FixtureMinigamePlatformAdapter();
const source = new MinigameArtifactSource(platformAdapter);

beforeAll(async () => {
  const runtimeAbi = new CocosRuntimeAbi();
  const platform = createMinigameAssetPlatformService(
    platformAdapter,
    source,
    runtimeAbi,
  );
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
    artifactVariantPreference: ['wechat'],
    runtimeVariant: 'wechat-test',
  };
  await installAssetPipelineWithConfiguration(configuration);
});

beforeEach(() => {
  resetManagedCocosAbiState();
  platformAdapter.fontPaths.length = 0;
  platformAdapter.readPaths.length = 0;
  vi.restoreAllMocks();
});

describe('Mini-game managed native artifacts', () => {
  it('loads managed TTFFont and MP3 from platform file paths', async () => {
    /// @case
    /// Mini-game Catalog records use local package paths for TTF and MP3
    /// native artifacts while their import JSON remains byte data.
    /// @expect
    /// Source returns platform-file artifacts, format decoders call loadFont
    /// and AudioPlayer with paths, and generic Link publishes both Assets.
    const fontHandle = assetPipeline.loadAsset<CocosAsset>(
      'managed-minigame-font',
    );
    const audioHandle = assetPipeline.loadAsset<CocosAsset>(
      'managed-minigame-audio',
    );
    const [font, audio] = await Promise.all([
      fontHandle.ready,
      audioHandle.ready,
    ]) as unknown as [TTFFont, AudioClip];

    expect(font).toBeInstanceOf(TTFFont);
    expect(font._nativeAsset).toBe('CycloMinigameFixtureFont');
    expect(audio).toBeInstanceOf(AudioClip);
    expect(audio._nativeAsset).toMatchObject({
      duration: 1,
      type: AudioClip.AudioType.WEB_AUDIO,
      url: '/package/audio.mp3',
    });
    expect(platformAdapter.fontPaths).toEqual(['/package/font.ttf']);
    expect(platformAdapter.readPaths).toEqual([
      '/package/font.json',
      '/package/audio.json',
    ]);
    expect(managedCocosAbiState.audioLoads)
      .toEqual(['/package/audio.mp3']);
    expect(managedCocosAbiState.onLoadedCalls.get(font._uuid)).toBe(1);
    expect(managedCocosAbiState.onLoadedCalls.get(audio._uuid)).toBe(1);

    fontHandle.release();
    audioHandle.release();
  });
});

function createCatalog(): AssetCatalog {
  const records = [
    createRecord(
      'managed-minigame-font',
      'cc.TTFFont',
      '/package/font.json',
      '/package/font.ttf',
      'ttf',
    ),
    createRecord(
      'managed-minigame-audio',
      'cc.AudioClip',
      '/package/audio.json',
      '/package/audio.mp3',
      'mp3',
    ),
  ];
  return {
    revision: 'managed-minigame-native-v1',
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
  importPath: string,
  nativePath: string,
  nativeFormat: string,
): AssetRecord {
  return {
    resourceId,
    cocosUuid: `${resourceId}-uuid`,
    runtimeTypeId,
    primaryArtifact: {
      sourceId: source.id,
      key: importPath,
      format: 'json',
      preferredKind: ArtifactKind.bytes,
    },
    auxiliaryArtifactSets: [{
      slot: 'native',
      candidates: [{
        variant: 'wechat',
        location: {
          sourceId: source.id,
          key: nativePath,
          format: nativeFormat,
          preferredKind: ArtifactKind.platformFile,
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
