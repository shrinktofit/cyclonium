import * as cc from 'cc';
import {
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import {
  AbortController,
  type AbortSignal,
} from '@cyclonium/abort-controller';

import type {
  AssetDecodeContext,
  AssetDecoder,
  RemoteAssetInstantiation,
  RemoteAssetLoader,
  RemoteAssetRequest,
} from '@/core/contracts.js';
import type {
  Artifact,
  ArtifactLocation,
  AssetCatalog,
  AssetRecord,
  DecodedAsset,
} from '@/core/model.js';
import { ArtifactKind } from '@/core/model.js';
import {
  LoadHandleState,
  type AssetType,
  type CycloAsset,
} from '@/core/public.js';
import { installAssetPipelineWithConfiguration } from '@/install.js';
import { AlipayPlatformAdapter } from '@/platform/alipay/alipay-platform-adapter.js';
import { BytedancePlatformAdapter } from '@/platform/bytedance/bytedance-platform-adapter.js';
import {
  createMinigameAssetPlatformService,
  MinigameArtifactSource,
} from '@/platform/minigame-shared/index.js';
import { WechatPlatformAdapter } from '@/platform/wechat/wechat-platform-adapter.js';
import {
  createNativeArtifactDecoderRegistry,
  createRemoteAssetLoader,
} from '@/runtime/cocos/index.js';
import type { AssetPipeline } from '@/asset-pipeline.js';
import {
  FakeAlipayMinigameApi,
  FakeHeaderStyleMinigameApi,
} from './fixtures/fake-minigame.js';
import {
  createRemoteTestConfiguration,
} from './fixtures/remote-configuration.js';

const wxApi = new FakeHeaderStyleMinigameApi('/tmp/wx-image.png');
const ttApi = new FakeHeaderStyleMinigameApi('/tmp/tt-image.png');
const myApi = new FakeAlipayMinigameApi('/tmp/my-image.png');
const wxAdapter = new WechatPlatformAdapter(wxApi);
const ttAdapter = new BytedancePlatformAdapter(ttApi);
const myAdapter = new AlipayPlatformAdapter(myApi);
const wxSource = new MinigameArtifactSource(wxAdapter);
const ttSource = new MinigameArtifactSource(ttAdapter);
const mySource = new MinigameArtifactSource(myAdapter);
const wxServices = createMinigameAssetPlatformService(
  wxAdapter,
  wxSource,
);
const wxNativeArtifactDecoders = createNativeArtifactDecoderRegistry(
  wxServices.nativeArtifactDecoders,
);
const wxLoader = createRemoteAssetLoader(
  wxSource.id,
  wxNativeArtifactDecoders,
);
const ttServices = createMinigameAssetPlatformService(ttAdapter, ttSource);
const ttLoader = createRemoteAssetLoader(
  ttSource.id,
  createNativeArtifactDecoderRegistry(ttServices.nativeArtifactDecoders),
);
const myServices = createMinigameAssetPlatformService(myAdapter, mySource);
const myLoader = createRemoteAssetLoader(
  mySource.id,
  createNativeArtifactDecoderRegistry(myServices.nativeArtifactDecoders),
);

let pipeline: AssetPipeline;

beforeAll(async () => {
  const baseConfiguration = createRemoteTestConfiguration(
    new MinigameRoutingRemoteAssetLoader({
      wx: wxLoader,
      tt: ttLoader,
      my: myLoader,
    }),
    [wxSource, ttSource, mySource],
  );
  pipeline = await installAssetPipelineWithConfiguration(
    {
      ...baseConfiguration,
      catalog: createHashedMinigameCatalog(),
      decoders: [new HashedByteDecoder()],
      sha256: wxServices.sha256,
    },
  );
});

describe('Mini-game remote asset loading', () => {
  it('verifies managed Byte Artifact hashes on wx, tt, and my', async () => {
    /// @case
    /// Managed byte records on all three mini-game adapters contain the exact
    /// SHA-256 digest of the fake SDK response bytes.
    /// @expect
    /// Every public load passes hash verification and reaches Decode as a
    /// BufferAsset without creating a temporary platform file.
    const handles = HASHED_MINIGAME_ARTIFACTS.map(({ route }) => (
      pipeline.loadAsset<cc.BufferAsset>(`hashed-${route}`)
    ));

    const assets = await Promise.all(handles.map(({ ready }) => ready));

    for (const asset of assets) {
      expect(asset).toBeInstanceOf(cc.BufferAsset);
    }
    expect(wxApi.lastRequest?.url).toBe(HASHED_MINIGAME_ARTIFACTS[0]?.url);
    expect(ttApi.lastRequest?.url).toBe(HASHED_MINIGAME_ARTIFACTS[1]?.url);
    expect(myApi.lastRequest?.url).toBe(HASHED_MINIGAME_ARTIFACTS[2]?.url);
    for (const handle of handles) {
      handle.release();
    }
  });

  it('rejects managed Byte Artifact hash mismatches on every adapter', async () => {
    /// @case
    /// wx, tt, and my each return bytes for a managed record whose Catalog
    /// digest is intentionally incorrect.
    /// @expect
    /// All public Handles fail during Acquire and none of the corrupt byte
    /// artifacts is decoded or published.
    for (const { route } of HASHED_MINIGAME_ARTIFACTS) {
      const handle = pipeline.loadAsset<cc.BufferAsset>(
        `mismatched-${route}`,
      );

      await expectAssetLoadFailure(
        handle.ready,
        'acquire',
        'does not match',
      );
      handle.release();
    }
  });

  it('normalizes wx, tt, and my request fields through the public API', async () => {
    /// @case
    /// The game loads remote assets through the WeChat, ByteDance, and Alipay
    /// routes while each fake SDK records its raw request options.
    /// @expect
    /// wx uses dataType "其他", tt uses "string", Alipay uses
    /// "arraybuffer", and all three return the requested Cocos Asset type.
    const wxHandle = pipeline.loadRemoteAsset(
      'https://game.test/wx/data.json',
      cc.JsonAsset,
    );
    const ttHandle = pipeline.loadRemoteAsset(
      'https://game.test/tt/readme.txt',
      cc.TextAsset,
    );
    const myHandle = pipeline.loadRemoteAsset(
      'https://game.test/my/data.json',
      cc.JsonAsset,
    );

    const [wxAsset, ttAsset, myAsset] = await Promise.all([
      wxHandle.ready,
      ttHandle.ready,
      myHandle.ready,
    ]);

    expect(wxApi.lastRequest).toMatchObject({
      method: 'GET',
      dataType: '其他',
      responseType: 'arraybuffer',
    });
    expect(ttApi.lastRequest).toMatchObject({
      method: 'GET',
      dataType: 'string',
      responseType: 'arraybuffer',
    });
    expect(myApi.lastRequest).toMatchObject({
      method: 'GET',
      dataType: 'arraybuffer',
    });
    expect(wxAsset).toBeInstanceOf(cc.JsonAsset);
    expect(ttAsset).toBeInstanceOf(cc.TextAsset);
    expect(myAsset).toBeInstanceOf(cc.JsonAsset);

    wxHandle.release();
    ttHandle.release();
    myHandle.release();
  });

  it('uses each SDK response status field for HTTP failure', async () => {
    /// @case
    /// wx and tt report errors through statusCode while Alipay reports the
    /// equivalent response through status.
    /// @expect
    /// Every non-success value rejects from loadRemoteAsset with its exact
    /// status and none is interpreted as a successful payload.
    wxApi.requestStatus = 401;
    const wxHandle = pipeline.loadRemoteAsset(
      'https://game.test/wx/unauthorized.txt',
      cc.TextAsset,
    );
    await expectAssetLoadFailure(wxHandle.ready, 'acquire', 'status 401');
    wxApi.requestStatus = 200;

    ttApi.requestStatus = 402;
    const ttHandle = pipeline.loadRemoteAsset(
      'https://game.test/tt/payment.txt',
      cc.TextAsset,
    );
    await expectAssetLoadFailure(ttHandle.ready, 'acquire', 'status 402');
    ttApi.requestStatus = 200;

    myApi.requestStatus = 403;
    const myHandle = pipeline.loadRemoteAsset(
      'https://game.test/my/forbidden.txt',
      cc.TextAsset,
    );
    await expectAssetLoadFailure(myHandle.ready, 'acquire', 'status 403');
    myApi.requestStatus = 200;
  });

  it('removes wx and tt temp paths returned with HTTP errors', async () => {
    /// @case
    /// WeChat and ByteDance downloadFile callbacks report HTTP 503 while also
    /// returning a platform-created tempFilePath.
    /// @expect
    /// The public load preserves the HTTP error and each orphan temp path is
    /// unlinked exactly once before the failed acquisition settles.
    const cases = [
      {
        route: 'wx',
        api: wxApi,
      },
      {
        route: 'tt',
        api: ttApi,
      },
    ];

    for (const testCase of cases) {
      testCase.api.downloadStatus = 503;
      const removedCount = testCase.api.removedFiles.length;
      const handle = pipeline.loadRemoteAsset(
        `https://game.test/${testCase.route}/unavailable.png`,
        cc.ImageAsset,
      );

      try {
        await expectAssetLoadFailure(handle.ready, 'acquire', 'status 503');
        expect(testCase.api.removedFiles).toHaveLength(removedCount + 1);
      } finally {
        testCase.api.downloadStatus = 200;
      }
    }
  });

  it('downloads platform files and decodes images on every adapter', async () => {
    /// @case
    /// Each mini-game platform loads a PNG through downloadFile followed by
    /// createImage, with ByteDance requested as Texture2D.
    /// @expect
    /// The exact platform temp path reaches createImage and the public result
    /// has the requested ImageAsset or Texture2D shape.
    const wxHandle = pipeline.loadRemoteAsset(
      'https://game.test/wx/avatar.png',
      cc.ImageAsset,
    );
    const ttHandle = pipeline.loadRemoteAsset(
      'https://game.test/tt/avatar.png',
      cc.Texture2D,
    );
    const myHandle = pipeline.loadRemoteAsset(
      'https://game.test/my/avatar.png',
      cc.ImageAsset,
    );

    const [wxImage, ttTexture, myImage] = await Promise.all([
      wxHandle.ready,
      ttHandle.ready,
      myHandle.ready,
    ]);

    expect(wxApi.lastDownload?.url).toContain('/wx/avatar.png');
    expect(ttApi.lastDownload?.url).toContain('/tt/avatar.png');
    expect(myApi.lastDownload?.url).toContain('/my/avatar.png');
    expect(wxApi.imageSources).toContain('/tmp/wx-image.png');
    expect(ttApi.imageSources).toContain('/tmp/tt-image.png');
    expect(myApi.imageSources).toContain('/tmp/my-image.png');
    expect(wxImage).toBeInstanceOf(cc.ImageAsset);
    expect(ttTexture).toBeInstanceOf(cc.Texture2D);
    expect(ttTexture.image).toBeInstanceOf(cc.ImageAsset);
    expect(myImage).toBeInstanceOf(cc.ImageAsset);

    wxHandle.release();
    ttHandle.release();
    myHandle.release();
  });

  it('uses MIME when a remote image has an unknown URL suffix', async () => {
    /// @case
    /// A mini-game avatar endpoint ends in .php while download headers report
    /// the actual image/png media type.
    /// @expect
    /// The unknown suffix does not shadow MIME inference and ImageAsset loads.
    const handle = pipeline.loadRemoteAsset(
      'https://game.test/wx/avatar.php',
      cc.ImageAsset,
    );

    expect(await handle.ready).toBeInstanceOf(cc.ImageAsset);

    handle.release();
  });

  it('never removes a local package path after managed image binding', async () => {
    /// @case
    /// A managed ImageAsset binds a PNG that already exists in the mini-game
    /// package instead of a path returned by downloadFile.
    /// @expect
    /// The image is decoded, but the package path is never passed to unlink.
    const controller = new AbortController();
    const artifact = await wxSource.acquire({
      sourceId: wxSource.id,
      key: '/package/avatar.png',
      format: 'png',
      preferredKind: ArtifactKind.platformFile,
    }, controller.signal);
    const removedCount = wxApi.removedFiles.length;

    await wxNativeArtifactDecoders.decode(
      artifact,
      '.png',
      undefined,
      controller.signal,
    );

    expect(wxApi.imageSources).toContain('/package/avatar.png');
    expect(wxApi.removedFiles).toHaveLength(removedCount);
  });

  it('shares a downloaded temp path and unlinks it exactly once', async () => {
    /// @case
    /// ImageAsset and Texture2D concurrently load the same remote PNG URL,
    /// creating two decode consumers for one physical platform file.
    /// @expect
    /// downloadFile runs once and the path is unlinked once only after both
    /// decode consumers have released their artifact leases.
    const downloadCount = wxApi.downloadCount;
    const removedCount = wxApi.removedFiles.length;
    const url = 'https://game.test/wx/shared-avatar.png';
    const imageHandle = pipeline.loadRemoteAsset(url, cc.ImageAsset);
    const textureHandle = pipeline.loadRemoteAsset(url, cc.Texture2D);

    await Promise.all([
      imageHandle.ready,
      textureHandle.ready,
    ]);

    expect(wxApi.downloadCount).toBe(downloadCount + 1);
    expect(wxApi.removedFiles).toHaveLength(removedCount + 1);
    expect(wxApi.removedFiles.at(-1)).toBe('/tmp/wx-image.png');

    imageHandle.release();
    textureHandle.release();
  });

  it('aborts each SDK task and ignores every late success callback', async () => {
    /// @case
    /// A caller aborts one deferred text request on each mini-game platform,
    /// after which each fake SDK invokes its original success callback late.
    /// @expect
    /// All request tasks are aborted exactly once and every public Handle
    /// remains Cancelled without accepting the late Asset.
    const cases = [
      {
        route: 'wx',
        api: wxApi,
      },
      {
        route: 'tt',
        api: ttApi,
      },
      {
        route: 'my',
        api: myApi,
      },
    ];

    for (const testCase of cases) {
      testCase.api.deferRequests = true;
      const previousAbortCount = testCase.api.abortCount;
      const controller = new AbortController();
      const handle = pipeline.loadRemoteAsset(
        `https://game.test/${testCase.route}/deferred.txt`,
        cc.TextAsset,
        {
          signal: controller.signal,
        },
      );

      controller.abort();

      await expect(handle.ready).rejects.toMatchObject({
        name: 'AbortError',
      });
      expect(testCase.api.abortCount).toBe(previousAbortCount + 1);

      testCase.api.completeDeferredRequests();
      await Promise.resolve();
      expect(handle.state).toBe(LoadHandleState.cancelled);
      expect(handle.value).toBeUndefined();
      testCase.api.deferRequests = false;
    }
  });

  it('removes a temp file returned after download cancellation', async () => {
    /// @case
    /// The caller aborts a deferred image download, but the platform still
    /// invokes its original success callback with a newly-created temp path.
    /// @expect
    /// The Handle remains cancelled and the otherwise-unowned late temp file
    /// is unlinked exactly once.
    wxApi.deferDownloads = true;
    const removedCount = wxApi.removedFiles.length;
    const controller = new AbortController();
    const handle = pipeline.loadRemoteAsset(
      'https://game.test/wx/late-avatar.png',
      cc.ImageAsset,
      {
        signal: controller.signal,
      },
    );
    await Promise.resolve();

    controller.abort();
    await expect(handle.ready).rejects.toMatchObject({
      name: 'AbortError',
    });

    wxApi.completeDeferredDownloads();
    await Promise.resolve();
    await Promise.resolve();

    expect(handle.state).toBe(LoadHandleState.cancelled);
    expect(wxApi.removedFiles).toHaveLength(removedCount + 1);
    expect(wxApi.removedFiles.at(-1)).toBe('/tmp/wx-image.png');
    wxApi.deferDownloads = false;
  });

  it('creates MP3 AudioClip from a temp path and rejects other audio formats', async () => {
    /// @case
    /// The game loads an Alipay MP3 and attempts to load an OGG from the same
    /// platform route.
    /// @expect
    /// The MP3 yields an AudioClip through the public pipeline, while OGG is
    /// rejected by the built-in remote audio format policy.
    const mp3Handle = pipeline.loadRemoteAsset(
      'https://game.test/my/music.mp3',
      cc.AudioClip,
    );

    const removedCount = myApi.removedFiles.length;
    expect(await mp3Handle.ready).toBeInstanceOf(cc.AudioClip);
    expect(myApi.removedFiles).toHaveLength(removedCount);
    mp3Handle.release();
    expect(myApi.removedFiles).toHaveLength(removedCount + 1);

    const oggHandle = pipeline.loadRemoteAsset(
      'https://game.test/my/music.ogg',
      cc.AudioClip,
      {
        format: 'ogg',
      },
    );
    await expectAssetLoadFailure(
      oggHandle.ready,
      'decode',
      'not supported for audio assets',
    );
  });
});

interface HashedMinigameArtifactSpec {
  readonly digest: string;
  readonly route: 'wx' | 'tt' | 'my';
  readonly sourceId: string;
  readonly url: string;
}

const HASHED_MINIGAME_ARTIFACTS: readonly HashedMinigameArtifactSpec[] = [
  {
    digest: '6766851ea4f45ea9e7ce25a13fe71fa84be4928a585659186f0b798704e86cca',
    route: 'wx',
    sourceId: wxSource.id,
    url: 'https://game.test/wx/hashed.bin',
  },
  {
    digest: '72d27715228f1addba2f93fee3e48533e25e724e187c98418879c83055953c28',
    route: 'tt',
    sourceId: ttSource.id,
    url: 'https://game.test/tt/hashed.bin',
  },
  {
    digest: 'e86714dd905c029625b6cb7918eaa5941d166a99f5514f2c0c653c4e16505baa',
    route: 'my',
    sourceId: mySource.id,
    url: 'https://game.test/my/hashed.bin',
  },
];

class HashedByteDecoder implements AssetDecoder {
  readonly id = 'hashed-byte-test';

  decode(
    _context: AssetDecodeContext,
    _signal: AbortSignal,
  ): Promise<DecodedAsset> {
    return Promise.resolve({
      asset: new cc.BufferAsset(),
      dependencyBindings: [],
    });
  }
}

function createHashedMinigameCatalog(): AssetCatalog {
  const keys = new Map<string, readonly string[]>();
  const records = new Map<string, AssetRecord>();
  for (const spec of HASHED_MINIGAME_ARTIFACTS) {
    addHashedRecord(keys, records, spec, false);
    addHashedRecord(keys, records, spec, true);
  }
  return {
    revision: 'minigame-hash-test',
    keys,
    cocosUuids: new Map(),
    records,
  };
}

function addHashedRecord(
  keys: Map<string, readonly string[]>,
  records: Map<string, AssetRecord>,
  spec: HashedMinigameArtifactSpec,
  mismatched: boolean,
): void {
  const prefix = mismatched ? 'mismatched' : 'hashed';
  const assetId = `${prefix}-${spec.route}`;
  const resourceId = `${assetId}-resource`;
  keys.set(assetId, [resourceId]);
  records.set(resourceId, {
    resourceId,
    runtimeTypeId: 'BufferAsset',
    primaryArtifact: {
      sourceId: spec.sourceId,
      key: spec.url,
      format: 'bin',
      hash: mismatched
        ? `sha256:${'0'.repeat(64)}`
        : `sha256:${spec.digest}`,
      revision: '1',
    },
    auxiliaryArtifactSets: [],
    directDependencies: [],
    revision: '1',
    decoderId: 'hashed-byte-test',
  });
}

async function expectAssetLoadFailure(
  ready: Promise<unknown>,
  stage: string,
  causeMessage: string,
): Promise<void> {
  const error = await ready.catch((reason: unknown) => reason);
  expect(error).toMatchObject({
    stage,
    cause: expect.objectContaining({
      message: expect.stringContaining(causeMessage),
    }),
  });
}

interface MinigameRoutes {
  readonly wx: RemoteAssetLoader;
  readonly tt: RemoteAssetLoader;
  readonly my: RemoteAssetLoader;
}

class MinigameRoutingRemoteAssetLoader implements RemoteAssetLoader {
  constructor(routes: MinigameRoutes) {
    this.#routes = routes;
  }

  supports<TAsset extends CycloAsset>(
    assetType: AssetType<TAsset>,
  ): boolean {
    return this.#routes.wx.supports(assetType)
      && this.#routes.tt.supports(assetType)
      && this.#routes.my.supports(assetType);
  }

  resolve<TAsset extends CycloAsset>(
    request: RemoteAssetRequest<TAsset>,
  ): ArtifactLocation {
    return this.#route(request.url).resolve(request);
  }

  instantiate<TAsset extends CycloAsset>(
    request: RemoteAssetRequest<TAsset>,
    artifact: Artifact,
    signal: AbortSignal,
  ): Promise<RemoteAssetInstantiation<TAsset>> {
    return this.#route(request.url).instantiate(
      request,
      artifact,
      signal,
    );
  }

  readonly #routes: MinigameRoutes;

  #route(url: string): RemoteAssetLoader {
    const route = url.includes('/wx/')
      ? this.#routes.wx
      : url.includes('/tt/')
        ? this.#routes.tt
        : url.includes('/my/')
          ? this.#routes.my
          : undefined;
    if (route === undefined) {
      throw new Error(
        `No mini-game test route matches "${url}".`,
      );
    }
    return route;
  }
}
