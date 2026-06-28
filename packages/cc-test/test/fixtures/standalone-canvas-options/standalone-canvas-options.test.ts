import * as cc from 'cc';
import { setupGame } from '@cyclonium/cc-test/runtime';
import { expect, it } from 'vitest';

it('should reject canvas options without an editor preview canvas', async () => {
  expect(cc.game).toBeDefined();

  await expect(setupGame({
    canvas: {
      size: {
        width: 128,
      },
    },
  })).rejects.toThrow(`Can not configure setupGame canvas before editor preview canvas is initialized.`);
});
