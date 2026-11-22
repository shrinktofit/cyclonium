import { baseURL } from '@cyclonium/cc-test/runtime';
import { expect, it } from 'vitest';

it('should expose the default editor baseURL', () => {
  /// @case The plugin is configured without an editor URL override.
  /// @expect Runtime resources use the default preview extension URL.
  expect(baseURL).toBe('http://localhost:12138/ext/volix.preview/');
});
