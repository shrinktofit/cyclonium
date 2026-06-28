import { baseURL, setupGame } from '@cyclonium/cc-test/runtime';
import * as cc from 'cc';
import { expect, it } from 'vitest';

it('should setup game manually through package runtime setup entry', async () => {
  expect(baseURL).toBe('http://localhost:7456/');

  await setupGame();

  expect(cc.game).toBeDefined();
});
