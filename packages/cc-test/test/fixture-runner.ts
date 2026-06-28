import { createVitest, TestCase, TestSuite, type TestRunResult, DefaultReporter, type SerializedError, TestModule } from 'vitest/node';
import type { ViteUserConfig } from 'vitest/config';
import { join, relative } from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import process from 'node:process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';

const fixturesDir = join(import.meta.dirname, './fixtures');
type PluginOption = NonNullable<ViteUserConfig['plugins']>[number];

export function fixtureOf(name: TemplateStringsArray) {
  return join(fixturesDir, name.join(''));
}

export async function runTestFixture(opts: {
  browser?: boolean;
  fixtureDir: string;
  plugins: PluginOption[];
  env?: Record<string, string>;
  update?: boolean | 'all' | 'new' | 'none';
}) {
  await installFixtureDependencies(opts.fixtureDir);

  const mockedEnvs = {
    entries: [] as Array<{ key: string; previous: string | undefined }>,
    [Symbol.dispose]() {
      for (const { key, previous } of mockedEnvs.entries) {
        if (previous === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = previous;
        }
      }
    },
  };
  if (opts.env) {
    for (const [key, value] of Object.entries(opts.env)) {
      const mockKey = `MOCK_${key}`;
      mockedEnvs.entries.push({ key: mockKey, previous: process.env[mockKey] });
      mockedEnvs.entries.push({ key, previous: process.env[key] });
      process.env[mockKey] = value;
      process.env[key] = value;
    }
  }

  const { browser = false, fixtureDir, plugins } = opts;
  const reporter = new FixtureReporter(relative(fixturesDir, fixtureDir), {});
  const vitest = await createVitest(
    'test',
    {
      root: fixtureDir,
      passWithNoTests: false,
      update: opts.update,
      watch: false,
      run: true,
      config: false,
      reporters: [
        reporter,
      ],
      projects: [{
        root: fixtureDir,
        envDir: opts.env ? fixtureOf`shared-env` : undefined,
        test: {
          fileParallelism: false,
          maxWorkers: 1,
          environment: browser ? undefined : 'node',
          browser: browser
            ? {
              enabled: true,
              provider: playwright(),
              headless: true,
              instances: [
                {
                  browser: 'chromium',
                },
              ],
            }
            : undefined,
        },
        plugins,
      }],
    },
  );
  try {
    const result = await vitest.start();
    return new FixtureRunResult(result);
  } finally {
    try {
      await vitest.close();
    } finally {
      mockedEnvs[Symbol.dispose]();
    }
  }
}

async function installFixtureDependencies(fixtureDir: string): Promise<void> {
  const dependencySourceDir = join(fixtureDir, 'dependency');
  if (existsSync(dependencySourceDir)) {
    await installFixtureDependency(fixtureDir, dependencySourceDir);
  }

  const dependenciesSourceDir = join(fixtureDir, 'dependencies');
  if (!existsSync(dependenciesSourceDir)) {
    return;
  }
  for (const packageSourceDir of await collectDependencySourceDirs(dependenciesSourceDir)) {
    await installFixtureDependency(fixtureDir, packageSourceDir);
  }
}

async function collectDependencySourceDirs(dependenciesSourceDir: string): Promise<string[]> {
  const packageSourceDirs: string[] = [];
  const entries = await readdir(dependenciesSourceDir, {
    withFileTypes: true,
  });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const entryPath = join(dependenciesSourceDir, entry.name);
    if (entry.name.startsWith('@')) {
      const scopedEntries = await readdir(entryPath, {
        withFileTypes: true,
      });
      packageSourceDirs.push(...scopedEntries.filter((scopedEntry) => {
        return scopedEntry.isDirectory();
      }).map((scopedEntry) => {
        return join(entryPath, scopedEntry.name);
      }));
    } else {
      packageSourceDirs.push(entryPath);
    }
  }
  return packageSourceDirs;
}

async function installFixtureDependency(fixtureDir: string, dependencySourceDir: string): Promise<void> {
  const dependencyPackageJson = JSON.parse(await readFile(join(dependencySourceDir, 'package.json'), 'utf8')) as DependencyPackageJson;
  if (!dependencyPackageJson.name) {
    throw new Error(`Missing fixture dependency package name: ${dependencySourceDir}`);
  }

  const nodeModulesDir = join(fixtureDir, 'node_modules');
  const dependencyTargetDir = join(nodeModulesDir, dependencyPackageJson.name);
  await rm(dependencyTargetDir, {
    force: true,
    recursive: true,
  });
  await mkdir(nodeModulesDir, {
    recursive: true,
  });
  await cp(dependencySourceDir, dependencyTargetDir, {
    recursive: true,
  });
}

interface DependencyPackageJson {
  name?: string;
}

export class FixtureReporter extends DefaultReporter {
  constructor(private _fixtureName: string, options: ConstructorParameters<typeof DefaultReporter>[0]) {
    super(options);
  }

  override log(...messages: unknown[]): void {
    super.log(...this._prefixMessages(messages));
  }

  override error(...messages: unknown[]): void {
    super.error(...this._prefixMessages(messages));
  }

  private _prefixMessages(messages: unknown[]) {
    if (messages.length === 0) {
      return messages;
    }
    if (typeof messages[0] === 'string') {
      return messages.map((m) => `[${this._fixtureName}] ${m}`);
    }
    return [`[${this._fixtureName}]`, ...messages];
  }
}

export class FixtureRunResult {
  constructor(private _result: TestRunResult) {
    if (this._result.unhandledErrors.length > 0) {
      this._ok = false;
    }
    for (const test of this._result.testModules) {
      if (test.state() !== 'passed') {
        this._ok = false;
      }
      this._collectErrorsInTestModule(test);
    }
    if (this._errors.length > 0) {
      this._ok = false;
    }
  }

  get ok() {
    return this._ok;
  }

  get errors() {
    return this._errors;
  }

  private _ok = true;
  private _errors: SerializedError[] = [];

  private _collectErrorsInTestModule(testModule: TestModule) {
    this._errors.push(...testModule.errors());
    for (const test of testModule.children) {
      this._collectErrorsInTestChild(test);
    }
  }

  private _collectErrorsInTestChild(testChild: TestSuite | TestCase) {
    if (testChild.type === 'suite') {
      this._collectErrorsInTestSuite(testChild);
      for (const test of testChild.children) {
        this._collectErrorsInTestChild(test);
      }
    } else {
      this._collectErrorsInTestCase(testChild);
    }
  }

  private _collectErrorsInTestSuite(testSuite: TestSuite) {
    this._errors.push(...testSuite.errors());
  }

  private _collectErrorsInTestCase(testCase: TestCase) {
    this._errors.push(...(testCase.result().errors || []));
  }
}
