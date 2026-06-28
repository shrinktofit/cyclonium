import { describe, expect, it } from 'vitest';
import thisPlugin from '@/vitest-plugin.js';
import { runTestFixture, fixtureOf } from './fixture-runner.js';

const standaloneEngineDir = process.env.VITE_CC_TEST_STANDALONE_ENGINE_DIR || '';
const canvasSnapshotFixtureDir = fixtureOf`canvas-snapshot`;
const canvasSnapshotMissingFixtureDir = fixtureOf`canvas-snapshot-missing`;
const canvasSnapshotMismatchFixtureDir = fixtureOf`canvas-snapshot-mismatch`;
const browserFixtureTimeout = 120_000;

describe('editor based mode', () => {
  it(`should emit error if current is not a browser environment`, async () => {
    const testResult = await runTestFixture({
      fixtureDir: fixtureOf`basic`,
      plugins: [
        thisPlugin({}),
      ],
    });
    expect(testResult.ok).toBe(false);
    expect(testResult.errors).toHaveLength(1);
    expect(testResult.errors[0].message).toBe(`Editor preview-based engine must be used in a browser testing environment like JSDOM or playwright etc.`);
  });

  it('should work in a browser environment', async () => {
    const testResult = await runTestFixture({
      browser: true,
      fixtureDir: fixtureOf`basic`,
      plugins: [
        thisPlugin({
          headless: false,
        }),
      ],
    });
    expect(testResult.ok).toBe(true);
  }, browserFixtureTimeout);

  it('should share runtime setup with virtual cc module', async () => {
    const testResult = await runTestFixture({
      browser: true,
      fixtureDir: fixtureOf`manual-runtime-setup`,
      plugins: [
        thisPlugin({
          autoInit: false,
          headless: false,
        }),
      ],
    });
    expect(testResult.ok).toBe(true);
  }, browserFixtureTimeout);

  it('should configure runtime baseURL through VITE_CC_TEST_EDITOR_BASE_URL env', async () => {
    const testResult = await runTestFixture({
      fixtureDir: fixtureOf`editor-runtime-injections`,
      plugins: [
        thisPlugin({
          autoInit: false,
        }),
      ],
      env: {
        VITE_CC_TEST_EDITOR_BASE_URL: 'http://localhost:7457/',
      },
    });
    expect(testResult.ok).toBe(true);
  });

  it('should allow browser dep optimizer to load the runtime package entry', async () => {
    const testResult = await runTestFixture({
      browser: true,
      fixtureDir: fixtureOf`published-runtime-consumer`,
      plugins: [
        thisPlugin({
          autoInit: false,
        }),
      ],
      env: {
        VITE_CC_TEST_EDITOR_BASE_URL: 'http://localhost:7457/',
      },
    });
    expect(testResult.ok).toBe(true);
  }, browserFixtureTimeout);

  it('should prefer editorBased.baseURL over VITE_CC_TEST_EDITOR_BASE_URL env', async () => {
    const testResult = await runTestFixture({
      fixtureDir: fixtureOf`editor-runtime-injections-plugin-option`,
      plugins: [
        thisPlugin({
          autoInit: false,
          editorBased: {
            baseURL: 'http://localhost:7458/',
          },
        }),
      ],
      env: {
        VITE_CC_TEST_EDITOR_BASE_URL: 'http://localhost:7457/',
      },
    });
    expect(testResult.ok).toBe(true);
  });

  it('should configure runtime baseURL with the default editor URL', async () => {
    const testResult = await runTestFixture({
      fixtureDir: fixtureOf`editor-runtime-injections-default`,
      plugins: [
        thisPlugin({
          autoInit: false,
        }),
      ],
    });
    expect(testResult.ok).toBe(true);
  });

  it('should configure the editor preview canvas', async () => {
    const testResult = await runTestFixture({
      browser: true,
      fixtureDir: fixtureOf`custom-canvas`,
      plugins: [
        thisPlugin({
          autoInit: false,
          headless: false,
          canvas: {
            id: 'ConfiguredGameCanvas',
            devicePixelRatio: 1.5,
            size: {
              width: 128,
              height: 64,
            },
          },
        }),
      ],
    });
    expect(testResult.ok).toBe(true);
  }, browserFixtureTimeout);

  it('should allow setupGame to customize the editor preview canvas', async () => {
    const testResult = await runTestFixture({
      browser: true,
      fixtureDir: fixtureOf`custom-canvas-setup-options`,
      plugins: [
        thisPlugin({
          autoInit: false,
          headless: false,
          canvas: {
            id: 'ConfiguredGameCanvas',
            devicePixelRatio: 1.5,
            size: {
              width: 128,
              height: 64,
            },
          },
        }),
      ],
    });
    expect(testResult.ok).toBe(true);
  }, browserFixtureTimeout);

  it('should resolve builtin assets from editor preview settings', async () => {
    const defaultBuiltinAssetsResult = await runTestFixture({
      browser: true,
      fixtureDir: fixtureOf`settings-builtin-assets-default`,
      plugins: [
        thisPlugin({
          autoInit: false,
          headless: false,
        }),
      ],
    });
    expect(defaultBuiltinAssetsResult.ok).toBe(true);

    const excludedBuiltinAssetsResult = await runTestFixture({
      browser: true,
      fixtureDir: fixtureOf`settings-builtin-assets-excludes`,
      plugins: [
        thisPlugin({
          autoInit: false,
          headless: false,
        }),
      ],
    });
    expect(excludedBuiltinAssetsResult.ok).toBe(true);
  }, browserFixtureTimeout);

  describe('canvas snapshot matcher', () => {
    it('should write and compare canvas snapshots through browser commands', async () => {
      const writeResult = await runTestFixture({
        browser: true,
        fixtureDir: canvasSnapshotFixtureDir,
        plugins: [
          thisPlugin({}),
        ],
        update: 'all',
      });
      expect(writeResult.ok).toBe(true);

      const compareResult = await runTestFixture({
        browser: true,
        fixtureDir: canvasSnapshotFixtureDir,
        plugins: [
          thisPlugin({}),
        ],
        update: 'none',
      });
      expect(compareResult.ok).toBe(true);
    }, browserFixtureTimeout);

    it('should report a missing canvas snapshot when snapshots are not updated', async () => {
      const testResult = await runTestFixture({
        browser: true,
        fixtureDir: canvasSnapshotMissingFixtureDir,
        plugins: [
          thisPlugin({}),
        ],
        update: 'none',
      });
      expect(testResult.ok).toBe(true);
    }, browserFixtureTimeout);

    it('should report mismatched canvas snapshot pixels', async () => {
      const testResult = await runTestFixture({
        browser: true,
        fixtureDir: canvasSnapshotMismatchFixtureDir,
        plugins: [
          thisPlugin({}),
        ],
        update: 'none',
      });
      expect(testResult.ok).toBe(true);
    }, browserFixtureTimeout);
  });
});

describe(`standalone mode`, () => {
  it('should inject an empty runtime baseURL', async () => {
    const testResult = await runTestFixture({
      fixtureDir: fixtureOf`standalone-runtime-injections`,
      plugins: [
        thisPlugin({
          defaultStrategy: 'standalone',
        }),
      ],
    });
    expect(testResult.ok).toBe(true);
  });

  it('should configure standalone constants through plugin options', async () => {
    const testResult = await runTestFixture({
      fixtureDir: fixtureOf`standalone-configure-plugin`,
      plugins: [
        thisPlugin({
          defaultStrategy: 'standalone',
          configure: {
            HEADLESS: false,
            DEBUG: false,
            NET_MODE: 7,
          },
          standalone: {
            dir: standaloneEngineDir,
          },
        }),
      ],
    });
    expect(testResult.ok).toBe(true);
  });

  it('should configure standalone constants through hoisted runtime configure', async () => {
    const testResult = await runTestFixture({
      fixtureDir: fixtureOf`standalone-configure-hoisted`,
      plugins: [
        thisPlugin({
          autoInit: false,
          defaultStrategy: 'standalone',
          configure: {
            DEBUG: false,
            NET_MODE: 6,
          },
          standalone: {
            dir: standaloneEngineDir,
          },
        }),
      ],
    });
    expect(testResult.ok).toBe(true);
  });

  it('should setup game automatically after importing cc', async () => {
    const testResult = await runTestFixture({
      fixtureDir: fixtureOf`standalone-auto-init`,
      plugins: [
        thisPlugin({
          defaultStrategy: 'standalone',
          standalone: {
            dir: standaloneEngineDir,
          },
        }),
      ],
    });
    expect(testResult.ok).toBe(true);
  });

  it('should reject canvas options without an editor preview canvas', async () => {
    const testResult = await runTestFixture({
      fixtureDir: fixtureOf`standalone-canvas-options`,
      plugins: [
        thisPlugin({
          autoInit: false,
          defaultStrategy: 'standalone',
          standalone: {
            dir: standaloneEngineDir,
          },
        }),
      ],
    });
    expect(testResult.ok).toBe(true);
  });

  describe('requires specifying the standalone.dir plugin option', () => {
    it('throw if standalone.dir is not specified', async () => {
      const testResult = await runTestFixture({
        fixtureDir: fixtureOf`use-standalone-mode`,
        plugins: [
          thisPlugin({
            autoInit: false,
            defaultStrategy: 'standalone',
          }),
        ],
        env: {
          VITE_CC_TEST_STANDALONE_ENGINE_DIR: '',
        },
      });
      expect(testResult.ok).toBe(false);
      expect(testResult.errors.length).toBeGreaterThan(0);
      const expectedMessage = `Standalone mode requires you specifying the 'standalone.dir' plugin option or 'VITE_CC_TEST_STANDALONE_ENGINE_DIR' plugin option.`;
      for (const error of testResult.errors) {
        expect(
          error.message === expectedMessage
          || error.cause?.message === expectedMessage,
          `Expected error.message or error.cause.message to be ${JSON.stringify(expectedMessage)}, got ${JSON.stringify({
            message: error.message,
            causeMessage: error.cause?.message,
          })}`,
        ).toBe(true);
      }
    });

    it('through standalone.dir plugin option', async () => {
      const testResult = await runTestFixture({
        fixtureDir: fixtureOf`use-standalone-mode`,
        plugins: [
          thisPlugin({
            autoInit: false,
            defaultStrategy: 'standalone',
            standalone: {
              dir: standaloneEngineDir,
            },
          }),
        ],
      });
      expect(testResult.ok).toBe(true);
    });

    it('through VITE_CC_TEST_STANDALONE_ENGINE_DIR env', async () => {
      const testResult = await runTestFixture({
        fixtureDir: fixtureOf`use-standalone-mode`,
        plugins: [
          thisPlugin({
            autoInit: false,
            defaultStrategy: 'standalone',
            standalone: {
            },
          }),
        ],
        env: {
          VITE_CC_TEST_STANDALONE_ENGINE_DIR: standaloneEngineDir,
        },
      });
      expect(testResult.ok).toBe(true);
    });
  });
});

it(`should allow different projects to use different cc modes`, async () => {
  const standaloneResult = await runTestFixture({
    fixtureDir: fixtureOf`use-standalone-mode`,
    plugins: [
      thisPlugin({
        autoInit: false,
        defaultStrategy: 'standalone',
        standalone: {
          dir: standaloneEngineDir,
        },
      }),
    ],
  });
  expect(standaloneResult.ok).toBe(true);

  const testResult = await runTestFixture({
    browser: true,
    fixtureDir: fixtureOf`basic`,
    plugins: [
      thisPlugin({
        headless: false,
      }),
    ],
  });
  expect(testResult.ok).toBe(true);
}, browserFixtureTimeout);
