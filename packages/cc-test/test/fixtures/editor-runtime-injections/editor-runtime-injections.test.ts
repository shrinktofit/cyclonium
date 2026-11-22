import { baseURL } from '@cyclonium/cc-test/runtime';
import { expect, it } from 'vitest';

it('should expose the editor baseURL from env', () => {
  expect(baseURL).toBe('http://localhost:12139/ext/volix.preview/');
});
