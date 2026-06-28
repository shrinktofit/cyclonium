import { setupGame } from '@cyclonium/cc-test/runtime';
import * as cc from 'cc';
import { expect, it } from 'vitest';

const DEFAULT_BUILTIN_ASSET_KEYS = [
  'builtin-unlit',
  'pipeline/post-process/tone-mapping',
];

const EXTRA_BUILTIN_ASSET_KEY = 'ui-base-material';

it('should load default builtin assets when builtinAssets is not specified', async () => {
  await setupGame();

  for (const assetKey of DEFAULT_BUILTIN_ASSET_KEYS) {
    expect(cc.builtinResMgr.get(assetKey)).toBeDefined();
  }
  expect(cc.builtinResMgr.get(EXTRA_BUILTIN_ASSET_KEY)).toBeUndefined();
});
