import { baseURL } from '@cyclonium/cc-test/runtime';
import { expect, it } from 'vitest';

it('should expose an empty baseURL in standalone mode', () => {
  expect(baseURL).toBe('');
});
