import { describe, expect, it } from 'vitest';
import { fixtureOf, runTestFixture } from './fixture-runner.js';

const browserFixtureTimeout = 120_000;

describe('Downloader', () => {
  describe('downloadImage', () => {
    it('should work in a Playwright browser environment', async () => {
      const testResult = await runTestFixture({
        browser: true,
        fixtureDir: fixtureOf`download-image`,
        plugins: [],
      });

      expect(testResult.ok).toBe(true);
      expect(testResult.errors).toEqual([]);
    }, browserFixtureTimeout);
  });
});
