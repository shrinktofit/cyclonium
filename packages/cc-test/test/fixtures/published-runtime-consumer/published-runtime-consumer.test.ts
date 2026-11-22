import { dependencyBaseURL } from 'cc-test-runtime-consumer';
import { expect, it } from 'vitest';

it('should expose runtime injections through a published dependency', () => {
  expect(dependencyBaseURL).toBe('http://localhost:12139/ext/volix.preview/');
});
