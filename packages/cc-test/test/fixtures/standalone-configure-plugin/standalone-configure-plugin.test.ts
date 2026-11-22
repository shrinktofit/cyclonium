import { DEBUG, HEADLESS, HTML5, NET_MODE, NODEJS } from 'cc/env';
import { expect, it } from 'vitest';

it('should apply plugin standalone configure options before importing cc/env', () => {
  /// @case Explicit plugin configuration selects Node instead of the default player platform.
  /// @expect The explicit platform and constant overrides take precedence over runtime defaults.
  expect(HTML5).toBe(false);
  expect(NODEJS).toBe(true);
  expect(HEADLESS).toBe(false);
  expect(DEBUG).toBe(false);
  expect(NET_MODE).toBe(7);
});
