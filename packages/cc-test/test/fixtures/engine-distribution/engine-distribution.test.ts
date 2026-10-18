import * as cc from 'cc';
import { Asset, AssetDocument, deserializeBinary, unpackAssets } from 'cc';
import { DEBUG, HEADLESS } from 'cc/env';
import { expect, it } from 'vitest';

it('exposes the engine distribution through named and namespace imports', async () => {
  /// @case A test imports the new engine interfaces alongside Asset through both ESM forms.
  /// @expect Both forms refer to the same classes, and AssetDocument accepts the imported Asset.
  expect(AssetDocument).toBe(cc.AssetDocument);
  expect(deserializeBinary).toBe(cc.deserializeBinary);
  expect(unpackAssets).toBe(cc.unpackAssets);
  const asset = new Asset();
  expect(new AssetDocument(asset).mainAsset).toBe(asset);
  expect(DEBUG).toBeTypeOf('boolean');
  expect(HEADLESS).toBeTypeOf('boolean');
  if (typeof document !== 'undefined') {
    const engine = await System.import('cc');
    expect(engine.WebGL2Device).toBeTypeOf('function');
    expect(engine.rendering).toBeTypeOf('object');
    const legacy = engine.cclegacy as { WebGL2Device: unknown; rendering: unknown };
    expect(legacy.WebGL2Device).toBe(engine.WebGL2Device);
    expect(legacy.rendering).toBe(engine.rendering);
    expect(Asset).toBe(engine.Asset);
    expect(AssetDocument).toBe(engine.AssetDocument);
    expect(Object.keys(cc).filter((name) => name !== '__synthetic').sort())
      .toEqual(Object.keys(engine).sort());
    for (const name of Object.keys(engine)) {
      expect((cc as unknown as Record<string, unknown>)[name]).toBe(engine[name]);
    }
  }
});
