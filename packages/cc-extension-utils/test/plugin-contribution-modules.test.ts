import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, type LibraryFormats } from 'vite';
import { describe, expect, it } from 'vitest';
import { contributionModules } from '../src/vite-plugins/contribution-modules.js';

interface BuildOutputFile {
  readonly code: string;
  readonly name: string;
}

async function buildFixture(format: LibraryFormats): Promise<BuildOutputFile[]> {
  const root = await mkdtemp(join(tmpdir(), 'cyclo-contribution-modules-'));
  const sourceRoot = join(root, 'src');
  const outDir = join(root, 'dist');
  const entryName = format === 'es' ? 'entry.mjs' : 'entry.cjs';

  try {
    await mkdir(sourceRoot, { recursive: true });
    await writeFile(
      join(sourceRoot, 'panel.ts'),
      [
        'export function register() {',
        '  return "registered"',
        '}',
        '',
      ].join('\n'),
    );
    await writeFile(
      join(sourceRoot, 'entry.ts'),
      [
        'import panelMain from "./panel.ts?contribution-script"',
        '',
        'export { panelMain }',
        '',
      ].join('\n'),
    );

    await build({
      configFile: false,
      logLevel: 'silent',
      root,
      plugins: [
        contributionModules({ sourceRoot }),
      ],
      build: {
        emptyOutDir: true,
        lib: {
          entry: join(sourceRoot, 'entry.ts'),
          fileName: (): string => entryName,
          formats: [format],
        },
        minify: false,
        outDir,
        rollupOptions: {
          external: [/^node:/],
        },
      },
    });

    return await readOutput(outDir);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

async function readOutput(outDir: string): Promise<BuildOutputFile[]> {
  const names = await readdir(outDir);
  const sortedNames = [...names].sort();

  return await Promise.all(sortedNames.map(async (name): Promise<BuildOutputFile> => ({
    code: await readFile(join(outDir, name), 'utf8'),
    name,
  })));
}

describe('contributionModules', () => {
  it('should emit contribution output from an ESM build', async (): Promise<void> => {
    await expect(buildFixture('es')).resolves.toMatchSnapshot();
  });

  it('should emit contribution output from a CJS build', async (): Promise<void> => {
    await expect(buildFixture('cjs')).resolves.toMatchSnapshot();
  });
});
