import { baseURL } from '@cyclonium/cc-test/runtime';
import { expect, it } from 'vitest';

it('should expose the default editor baseURL', () => {
  expect(baseURL).toBe('http://localhost:7456/');
});
