import * as cc from 'cc';
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  AbortController,
} from '@cyclonium/abort-controller';

import { ArtifactKind } from '@/core/model.js';
import { installAssetPipelineWithConfiguration } from '@/install.js';
import { WebArtifactSource } from '@/platform/web/web-artifact-source.js';
import {
  createWebAssetPlatformService,
} from '@/platform/web/platform.js';
import {
  createNativeArtifactDecoderRegistry,
  createRemoteAssetLoader,
} from '@/runtime/cocos/index.js';
import type { AssetPipeline } from '@/asset-pipeline.js';
import {
  createRemoteTestConfiguration,
} from './fixtures/remote-configuration.js';

const requestCounts = new Map<string, number>();
const OFFSET_IMAGE_URL = 'https://assets.test/offset-image.png';
const OFFSET_IMAGE_BYTES = new Uint8Array([0, 137, 80, 78, 71, 255]);
let abortedFetches = 0;
let pipeline: AssetPipeline;

class TestWebArtifactSource extends WebArtifactSource {
  override acquire(
    ...parameters: Parameters<WebArtifactSource['acquire']>
  ): ReturnType<WebArtifactSource['acquire']> {
    const [location] = parameters;
    if (location.key === OFFSET_IMAGE_URL) {
      return Promise.resolve({
        kind: ArtifactKind.bytes,
        bytes: OFFSET_IMAGE_BYTES.subarray(1, 5),
        format: location.format,
        sourceId: this.id,
        contentType: 'image/png',
      });
    }
    return super.acquire(...parameters);
  }
}

const fetchImplementation: typeof fetch = async (
  input,
  init,
): Promise<Response> => {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
  requestCounts.set(url, (requestCounts.get(url) ?? 0) + 1);

  if (url.endsWith('/404.txt')) {
    return new Response('missing', {
      status: 404,
    });
  }
  if (url.endsWith('/slow.txt')) {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        abortedFetches += 1;
        const error = new Error('fetch aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    });
  }

  const contentType = (() => {
    if (url.endsWith('/catalog')) {
      return 'application/json';
    }
    if (url.endsWith('/avatar.php')) {
      return 'image/png';
    }
    if (url.endsWith('.png')) {
      return 'image/png';
    }
    if (url.endsWith('.mp3')) {
      return 'audio/mpeg';
    }
    if (
      url.endsWith('.txt')
      || url.endsWith('/shared-text')
    ) {
      return 'application/json';
    }
    return undefined;
  })();
  const body = (() => {
    if (url.endsWith('/catalog')) {
      return JSON.stringify({ version: 7 });
    }
    if (url.endsWith('.png')) {
      return new Uint8Array([137, 80, 78, 71]);
    }
    if (url.endsWith('/avatar.php')) {
      return new Uint8Array([137, 80, 78, 71]);
    }
    if (url.endsWith('.mp3')) {
      return new Uint8Array([73, 68, 51]);
    }
    if (url.endsWith('/bytes')) {
      return new Uint8Array([1, 2, 3]);
    }
    if (url.endsWith('/unknown')) {
      return new Uint8Array([0]);
    }
    return 'hello';
  })();

  return new Response(body, {
    headers: contentType === undefined
      ? undefined
      : {
        'content-type': contentType,
      },
  });
};

beforeAll(async () => {
  const source = new TestWebArtifactSource('web-test', fetchImplementation);
  const platform = createWebAssetPlatformService(source);
  pipeline = await installAssetPipelineWithConfiguration(
    createRemoteTestConfiguration(
      createRemoteAssetLoader(
        source.id,
        createNativeArtifactDecoderRegistry(
          platform.nativeArtifactDecoders,
        ),
      ),
      [source],
      1024,
    ),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Web remote asset loading', () => {
  it('reports streamed bytes with Content-Length when available', async () => {
    /// @case
    /// The Web Source receives a streamed Fetch response with a valid
    /// Content-Length header.
    /// @expect
    /// Its internal progress contract reports real loaded bytes and the
    /// server-provided total without inventing a percentage.
    const source = new WebArtifactSource(
      'progress-source',
      () => Promise.resolve(new Response(
        new Uint8Array([1, 2, 3, 4]),
        {
          headers: {
            'content-length': '4',
          },
        },
      )),
    );
    const progress: Array<{
      readonly loadedBytes: number;
      readonly totalBytes?: number;
    }> = [];

    await source.acquire(
      {
        sourceId: source.id,
        key: 'https://assets.test/progress.bin',
        format: 'bin',
      },
      new AbortController().signal,
      (snapshot) => {
        progress.push(snapshot);
      },
    );

    expect(progress.at(-1)).toEqual({
      loadedBytes: 4,
      totalBytes: 4,
    });
  });

  it('loads byte, text, and JSON assets through the public pipeline', async () => {
    /// @case
    /// The game loads raw bytes, a .txt URL whose MIME is misleading, and an
    /// extensionless JSON URL whose MIME supplies the missing format.
    /// @expect
    /// Asset type selects construction, suffix wins before MIME, and MIME is
    /// used only when the URL has no usable suffix.
    const bufferHandle = pipeline.loadRemoteAsset(
      'https://assets.test/bytes',
      cc.BufferAsset,
    );
    const textHandle = pipeline.loadRemoteAsset(
      'https://assets.test/readme.txt',
      cc.TextAsset,
    );
    const jsonHandle = pipeline.loadRemoteAsset(
      'https://assets.test/catalog',
      cc.JsonAsset,
    );

    const [buffer, text, json] = await Promise.all([
      bufferHandle.ready,
      textHandle.ready,
      jsonHandle.ready,
    ]);

    expect(Array.from(new Uint8Array(buffer.buffer()))).toEqual([1, 2, 3]);
    expect(text.text).toBe('hello');
    expect(json.json).toEqual({ version: 7 });

    bufferHandle.release();
    textHandle.release();
    jsonHandle.release();
  });

  it('rejects unknown formats and non-success HTTP responses', async () => {
    /// @case
    /// A typed text request has neither a recognizable suffix nor MIME, and a
    /// second request receives HTTP 404.
    /// @expect
    /// Neither request falls back to bytes or produces an Asset.
    const unknown = pipeline.loadRemoteAsset(
      'https://assets.test/unknown',
      cc.TextAsset,
    );
    await expectAssetLoadFailure(
      unknown.ready,
      'decode',
      'could not be inferred',
    );

    const missing = pipeline.loadRemoteAsset(
      'https://assets.test/404.txt',
      cc.TextAsset,
    );
    await expectAssetLoadFailure(missing.ready, 'acquire', 'status 404');
  });

  it('aborts the shared fetch after its final caller cancels', async () => {
    /// @case
    /// One caller starts a slow remote request and aborts its Handle before
    /// fetch completes.
    /// @expect
    /// The public Handle rejects as cancelled and the underlying fetch sees
    /// exactly one AbortSignal transition.
    const controller = new AbortController();
    const handle = pipeline.loadRemoteAsset(
      'https://assets.test/slow.txt',
      cc.TextAsset,
      {
        signal: controller.signal,
      },
    );

    controller.abort();

    await expect(handle.ready).rejects.toMatchObject({
      name: 'AbortError',
    });
    await vi.waitFor(() => {
      expect(abortedFetches).toBe(1);
    });
  });

  it('merges concurrent callers and destroys only after the final release', async () => {
    /// @case
    /// Two callers concurrently load the same URL and independently release
    /// their Handles.
    /// @expect
    /// Only one fetch and one Asset exist; the first release preserves the
    /// shared Asset and the second release destroys it.
    const url = 'https://assets.test/shared-text';
    const firstHandle = pipeline.loadRemoteAsset(url, cc.TextAsset, {
      format: 'text',
    });
    const secondHandle = pipeline.loadRemoteAsset(url, cc.TextAsset, {
      format: 'text',
    });

    const [first, second] = await Promise.all([
      firstHandle.ready,
      secondHandle.ready,
    ]);

    expect(first).toBe(second);
    expect(requestCounts.get(url)).toBe(1);
    const thirdHandle = pipeline.loadRemoteAsset(url, cc.TextAsset, {
      format: 'text',
    });
    expect(await thirdHandle.ready).toBe(first);
    expect(requestCounts.get(url)).toBe(1);
    const destroy = vi.spyOn(first, 'destroy');

    firstHandle.release();
    expect(destroy).not.toHaveBeenCalled();

    secondHandle.release();
    expect(destroy).not.toHaveBeenCalled();

    thirdHandle.release();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('reuses cached remote bytes after the runtime Asset is released', async () => {
    /// @case
    /// A remote text Asset is fully released and then loaded again while the
    /// configured byte Artifact budget can retain its response.
    /// @expect
    /// The second runtime Asset is newly constructed from cached bytes without
    /// issuing another Fetch.
    const url = 'https://assets.test/cache.txt';
    const firstHandle = pipeline.loadRemoteAsset(url, cc.TextAsset);
    const first = await firstHandle.ready;
    firstHandle.release();

    const secondHandle = pipeline.loadRemoteAsset(url, cc.TextAsset);
    const second = await secondHandle.ready;

    expect(second).not.toBe(first);
    expect(requestCounts.get(url)).toBe(1);

    secondHandle.release();
  });

  it('reserves a ready remote Asset until the next Handle retains it', async () => {
    /// @case
    /// A second Handle is created for an already-ready remote Asset and the
    /// original Handle releases synchronously before the second ready promise
    /// settles.
    /// @expect
    /// The cache handoff reservation prevents destruction between those two
    /// microtasks, and the second Handle receives the original live Asset.
    const url = 'https://assets.test/handoff.txt';
    const firstHandle = pipeline.loadRemoteAsset(url, cc.TextAsset);
    const first = await firstHandle.ready;
    const destroy = vi.spyOn(first, 'destroy');

    const secondHandle = pipeline.loadRemoteAsset(url, cc.TextAsset);
    firstHandle.release();

    expect(destroy).not.toHaveBeenCalled();
    expect(await secondHandle.ready).toBe(first);
    expect(destroy).not.toHaveBeenCalled();

    secondHandle.release();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('returns a cancelled caller reservation on a cached remote Asset', async () => {
    /// @case
    /// Two callers join a cached remote Asset and one releases before the
    /// shared Ready operation delivers the other caller.
    /// @expect
    /// The cancelled caller returns its reservation, so the Asset is destroyed
    /// after the original and surviving Handles release.
    const url = 'https://assets.test/cancelled-reservation.txt';
    const originalHandle = pipeline.loadRemoteAsset(url, cc.TextAsset);
    const asset = await originalHandle.ready;
    const destroy = vi.spyOn(asset, 'destroy');

    const cancelledHandle = pipeline.loadRemoteAsset(url, cc.TextAsset);
    const survivingHandle = pipeline.loadRemoteAsset(url, cc.TextAsset);
    const cancelledReady = cancelledHandle.ready;
    cancelledHandle.release();

    await expect(cancelledReady).rejects.toMatchObject({
      name: 'AbortError',
    });
    await expect(survivingHandle.ready).resolves.toBe(asset);

    originalHandle.release();
    survivingHandle.release();

    expect(destroy).toHaveBeenCalledOnce();
  });

  it('creates ImageAsset and Texture2D from decoded PNG data', async () => {
    /// @case
    /// The game requests the same physical PNG as an ImageAsset and as a
    /// Texture2D while browser decoding is supplied by the platform.
    /// @expect
    /// The requested Cocos types are constructed and Texture2D owns a linked
    /// ImageAsset without using Cocos AssetManager.
    const bitmap = {
      close: vi.fn(),
    } as unknown as ImageBitmap;
    const createBitmap = vi.fn((
      _source: ImageBitmapSource,
      _options?: ImageBitmapOptions,
    ) => Promise.resolve(bitmap));
    vi.stubGlobal('createImageBitmap', createBitmap);

    const url = 'https://assets.test/shared-image.png';
    const imageHandle = pipeline.loadRemoteAsset(
      url,
      cc.ImageAsset,
    );
    const textureHandle = pipeline.loadRemoteAsset(
      url,
      cc.Texture2D,
    );

    const image = await imageHandle.ready;
    const texture = await textureHandle.ready;

    expect(image).toBeInstanceOf(cc.ImageAsset);
    expect(texture).toBeInstanceOf(cc.Texture2D);
    expect(texture.image).toBeInstanceOf(cc.ImageAsset);
    expect(requestCounts.get(url)).toBe(1);
    expect(createBitmap).toHaveBeenCalledTimes(2);
    for (const [, options] of createBitmap.mock.calls) {
      expect(options).toEqual({
        premultiplyAlpha: 'none',
      });
    }

    imageHandle.release();
    textureHandle.release();
  });

  it('creates an image Blob from only the ByteArtifact view range', async () => {
    /// @case
    /// A Web Source returns PNG bytes as a subarray surrounded by unrelated
    /// bytes in the same ArrayBuffer.
    /// @expect
    /// The Blob receives a Uint8Array view over exactly the artifact range,
    /// without an eager slice copy or either surrounding byte.
    const blobConstructions = captureBlobConstructions();
    const bitmap = {
      close: vi.fn(),
    } as unknown as ImageBitmap;
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.resolve(bitmap)),
    );

    const handle = pipeline.loadRemoteAsset(
      OFFSET_IMAGE_URL,
      cc.ImageAsset,
    );

    expect(await handle.ready).toBeInstanceOf(cc.ImageAsset);
    expect(blobConstructions).toHaveLength(1);
    const construction = blobConstructions[0];
    const part = construction?.parts[0];
    expect(part).toBeInstanceOf(Uint8Array);
    if (!(part instanceof Uint8Array)) {
      throw new TypeError('The image Blob part is not a Uint8Array view.');
    }
    expect(part.buffer).toBe(OFFSET_IMAGE_BYTES.buffer);
    expect(part.byteOffset).toBe(1);
    expect([...part]).toEqual([137, 80, 78, 71]);
    expect(construction?.blob.type).toBe('image/png');
    expect(construction?.blob.size).toBe(4);

    handle.release();
  });

  it('uses MIME when a remote image has an unknown URL suffix', async () => {
    /// @case
    /// A Web avatar endpoint ends in .php while Fetch reports image/png.
    /// @expect
    /// The unknown suffix does not shadow MIME inference and ImageAsset loads.
    const bitmap = {
      close: vi.fn(),
    } as unknown as ImageBitmap;
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.resolve(bitmap)),
    );
    const handle = pipeline.loadRemoteAsset(
      'https://assets.test/avatar.php',
      cc.ImageAsset,
    );

    expect(await handle.ready).toBeInstanceOf(cc.ImageAsset);

    handle.release();
  });

  it('accepts only MP3 audio and revokes its Blob URL on release', async () => {
    /// @case
    /// The game requests one MP3 and one unsupported OGG AudioClip, then
    /// releases the successful Handle.
    /// @expect
    /// MP3 becomes a playable AudioClip, OGG fails explicitly, and releasing
    /// the AudioClip revokes its instance-owned Blob URL exactly once.
    const blobConstructions = captureBlobConstructions();
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:cyclo-audio');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL');
    const mp3Handle = pipeline.loadRemoteAsset(
      'https://assets.test/music.mp3',
      cc.AudioClip,
    );
    const oggHandle = pipeline.loadRemoteAsset(
      'https://assets.test/music.ogg',
      cc.AudioClip,
      {
        format: 'ogg',
      },
    );

    const mp3 = await mp3Handle.ready;
    const destroy = vi.spyOn(mp3, 'destroy');
    expect(mp3).toBeInstanceOf(cc.AudioClip);
    expect(createObjectUrl).toHaveBeenCalledOnce();
    await expectAssetLoadFailure(
      oggHandle.ready,
      'decode',
      'not supported for audio assets',
    );
    expect(blobConstructions).toHaveLength(1);
    const audioConstruction = blobConstructions[0];
    const audioPart = audioConstruction?.parts[0];
    expect(audioPart).toBeInstanceOf(Uint8Array);
    if (!(audioPart instanceof Uint8Array)) {
      throw new TypeError('The audio Blob part is not a Uint8Array view.');
    }
    expect([...audioPart]).toEqual([73, 68, 51]);
    expect(audioConstruction?.blob.type).toBe('audio/mpeg');

    mp3Handle.release();
    mp3Handle.release();

    expect(destroy).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:cyclo-audio');
  });
});

interface BlobConstruction {
  readonly blob: Blob;
  readonly options: BlobPropertyBag | undefined;
  readonly parts: readonly BlobPart[];
}

function captureBlobConstructions(): BlobConstruction[] {
  const NativeBlob = globalThis.Blob;
  const constructions: BlobConstruction[] = [];
  class CapturingBlob extends NativeBlob {
    constructor(
      parts: BlobPart[] = [],
      options?: BlobPropertyBag,
    ) {
      super(parts, options);
      constructions.push({
        blob: this,
        options,
        parts,
      });
    }
  }
  vi.stubGlobal('Blob', CapturingBlob);
  return constructions;
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
