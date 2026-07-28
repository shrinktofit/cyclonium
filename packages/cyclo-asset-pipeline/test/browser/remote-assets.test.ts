import {
  ImageAsset,
  JsonAsset,
  TextAsset,
  Texture2D,
} from 'cc';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  assetPipeline,
} from '../../src/index.js';

import './browser-runtime-configuration.js';

describe('Web remote assets with the Cocos runtime', () => {
  it('creates TextAsset from a local HTTP response', async () => {
    /// @case
    /// A local HTTP fixture supplies text/plain content at a .txt URL.
    /// @expect
    /// The Web pipeline creates a real Cocos TextAsset containing the
    /// response text.
    const handle = assetPipeline.loadRemoteAsset(
      '/__cyclo_asset_pipeline__/greeting.txt',
      TextAsset,
    );

    const asset = await handle.ready;
    expect(asset).toBeInstanceOf(TextAsset);
    expect(asset.text).toBe('hello from Cyclo');

    handle.release();
  });

  it('creates JsonAsset from a content-typed URL', async () => {
    /// @case
    /// A JSON data URL has no file suffix but supplies application/json.
    /// @expect
    /// MIME inference selects JSON and the returned object is a Cocos
    /// JsonAsset containing the parsed value.
    const handle = assetPipeline.loadRemoteAsset(
      '/__cyclo_asset_pipeline__/typed-json',
      JsonAsset,
    );

    const asset = await handle.ready;
    expect(asset).toBeInstanceOf(JsonAsset);
    expect(asset.json).toEqual({ answer: 42 });

    handle.release();
  });

  it('creates ImageAsset and Texture2D from PNG bytes', async () => {
    /// @case
    /// The same valid PNG is requested as an ImageAsset and a Texture2D.
    /// @expect
    /// Each requested runtime type is constructed through the Web image
    /// decoder and can be released through its Handle.
    const png = '/__cyclo_asset_pipeline__/pixel.png';
    const imageHandle = assetPipeline.loadRemoteAsset(png, ImageAsset);
    const textureHandle = assetPipeline.loadRemoteAsset(png, Texture2D);
    const [image, texture] = await Promise.all([
      imageHandle.ready,
      textureHandle.ready,
    ]);

    expect(image).toBeInstanceOf(ImageAsset);
    expect(texture).toBeInstanceOf(Texture2D);

    imageHandle.release();
    textureHandle.release();
  });
});
