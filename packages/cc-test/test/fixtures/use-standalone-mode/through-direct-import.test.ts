import * as cc from 'cc';
import { expect, it } from 'vitest';

it('_', () => {
  expect(cc).toBeDefined();
  expect(cc.VERSION).toBeTypeOf('string');
});
