import { baseURL } from '@cyclonium/cc-test/runtime';
import { expect, it } from 'vitest';

it('should expose the editor baseURL from plugin options', () => {
  expect(baseURL).toBe('http://localhost:7458/');
});
