import * as cc from 'cc';
import { expect, it } from 'vitest';

it('should initialize game automatically after importing cc', () => {
  expect(cc.game.inited).toBe(true);
});
