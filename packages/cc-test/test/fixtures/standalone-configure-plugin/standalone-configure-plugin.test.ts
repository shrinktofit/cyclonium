import { DEBUG, HEADLESS, NET_MODE } from 'cc/env';
import { expect, it } from 'vitest';

it('should apply plugin standalone configure options before importing cc/env', () => {
  expect(HEADLESS).toBe(false);
  expect(DEBUG).toBe(false);
  expect(NET_MODE).toBe(7);
});
