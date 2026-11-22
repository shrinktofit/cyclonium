import { baseURL, setupGame } from '@cyclonium/cc-test/runtime';
import * as cc from 'cc';
import { expect, it } from 'vitest';

it('should setup game manually through package runtime setup entry', async () => {
  /// @case Manually initialize the engine using the configured live editor URL.
  /// @expect The package runtime and virtual cc entry share the initialized game.
  expect(new URL(baseURL).pathname).toBe('/ext/volix.preview/');

  await setupGame();

  expect(cc.game).toBeDefined();
});
