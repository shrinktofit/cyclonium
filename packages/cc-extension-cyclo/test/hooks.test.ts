import { isAbsolute } from 'node:path';

import { describe, expect, it } from 'vitest';

import { toExtensionRelativeContributionPath } from '../src/contribution-path.js';

describe('Cyclo contribution path', () => {
  it('converts an emitted script to an extension-relative portable path', () => {
    const scriptPath = toExtensionRelativeContributionPath(
      'U:\\extension',
      'U:\\extension\\dist\\contributions\\builder.cjs',
    );

    expect(isAbsolute(scriptPath)).toBe(false);
    expect(scriptPath).toBe('dist/contributions/builder.cjs');
  });
});
