import { Asset, AssetDocument } from 'cc';
import { HTML5, NODEJS } from 'cc/env';
import { expect, it } from 'vitest';

it('loads the player engine without an editor bridge', () => {
  /// @case Import the public engine entry in Node or Chromium using the standalone strategy.
  /// @expect Player filesystem selection succeeds without Node editor integrations, and AssetDocument retains its Asset.
  expect(HTML5).toBe(true);
  expect(NODEJS).toBe(false);
  expect('EditorExtends' in globalThis).toBe(false);
  const asset = new Asset();
  expect(new AssetDocument(asset).mainAsset).toBe(asset);
});
