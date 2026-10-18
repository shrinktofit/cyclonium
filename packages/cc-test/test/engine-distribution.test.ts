import process from 'node:process';
import { describe, expect, it } from 'vitest';
import ccTest from '@/vitest-plugin.js';
import { fixtureOf, runTestFixture } from './fixture-runner.js';

describe('Eng engine distribution integration', () => {
  it('uses the standalone test-engine public entries', async () => {
    /// @case Load a compiled Eng distribution through the public Vitest plugin.
    /// @expect Configuration, named exports and Asset identity survive the ESM bridge.
    const result = await runTestFixture({
      fixtureDir: fixtureOf`engine-distribution`,
      plugins: ccTest({
        defaultStrategy: 'standalone',
        autoInit: false,
        standalone: { dir: process.env.VITE_CC_TEST_STANDALONE_ENGINE_DIR },
      }),
    });
    expect(result.ok, result.errors.map((error) => error.message).join('\n')).toBe(true);
  }, 120_000);

  it.each([false, true])('uses the editor preview guide and actual engine export names (headless: %s)', async (headless) => {
    /// @case Load the same public interfaces from an editor preview server in Chromium.
    /// @expect Both headless options retain the fixed graphics features and share all ESM exports with the engine.
    const result = await runTestFixture({
      browser: true,
      fixtureDir: fixtureOf`engine-distribution`,
      plugins: ccTest({
        autoInit: false,
        headless,
        editorBased: { baseURL: process.env.VITE_CC_TEST_EDITOR_BASE_URL },
      }),
    });
    expect(result.ok, result.errors.map((error) => error.message).join('\n')).toBe(true);
  }, 120_000);
});
