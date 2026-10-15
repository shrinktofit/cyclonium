import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import process from 'node:process';
import { after, describe, it } from 'node:test';
import spawn from 'cross-spawn';

const root = join(import.meta.dirname, '..');
const cache = join(root, 'node_modules', '.cache');
mkdirSync(cache, { recursive: true });
const temporaryDirectory = mkdtempSync(join(cache, 'package-ranges-'));
after(() => rmSync(temporaryDirectory, { recursive: true, force: true }));
const dependencyFields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const packages = readPackages(root);
const packagesByName = new Map(packages.map((pkg) => [pkg.manifest.name, pkg]));

function readPackages(directory) {
  return readdirSync(join(directory, 'packages')).map((name) => {
    const packageDirectory = join(directory, 'packages', name);
    return {
      directory: packageDirectory,
      manifest: JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8')),
    };
  });
}

function pack(directory, archive) {
  const result = spawn.sync('pnpm', ['pack', '--out', relative(directory, archive)], {
    cwd: directory,
    windowsHide: true,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return JSON.parse(execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' }));
}

function assertPackedRanges(manifest, workspacePackages) {
  for (const field of dependencyFields) {
    for (const [name, range] of Object.entries(manifest[field] ?? {})) {
      const dependency = workspacePackages.get(name);
      if (dependency) {
        assert.equal(range, `^${dependency.manifest.version}`, `${manifest.name} ${field}.${name}`);
      }
    }
  }
}

describe('published workspace dependency ranges', () => {
  it('should pack internal dependencies and peers as caret ranges for every public package', () => {
    /// @case
    /// Pack every public workspace package with the actual pinned pnpm CLI.
    /// @expect
    /// Tarball manifests use caret ranges at the workspace version, including the core polyfill minimum.
    for (const pkg of packages.filter((pkg) => !pkg.manifest.private)) {
      const archive = join(temporaryDirectory, `${pkg.manifest.name.replace('/', '-').replace('@', '')}.tgz`);
      assertPackedRanges(pack(pkg.directory, archive), packagesByName);
    }
  });

  it('should accept a newer compatible core peer and reject older or next-major providers', () => {
    /// @case
    /// Install the real canvas-3d tarball against minimal local core peer providers.
    /// @expect
    /// pnpm accepts a compatible minor, rejects a pre-polyfill version and the next major, and keeps the lockfile reproducible.
    const canvas = packagesByName.get('@cyclonium/canvas-3d');
    const canvasArchive = join(temporaryDirectory, 'canvas.tgz');
    pack(canvas.directory, canvasArchive);
    const [major, minor] = packagesByName.get('@cyclonium/core').manifest.version.split('.').map(Number);
    for (const [name, version, compatible] of [
      ['compatible', `${major}.${minor + 1}.0`, true],
      ['too-old', '1.0.1', false],
      ['next-major', `${major + 1}.0.0`, false],
    ]) {
      const directory = join(temporaryDirectory, name);
      const provider = join(directory, 'provider');
      mkdirSync(provider, { recursive: true });
      writeFileSync(join(provider, 'package.json'), JSON.stringify({ name: '@cyclonium/core', version }));
      const providerArchive = join(directory, 'core.tgz');
      pack(provider, providerArchive);
      writeFileSync(join(directory, 'package.json'), JSON.stringify({
        private: true,
        dependencies: {
          '@cyclonium/core': 'file:core.tgz',
          '@cyclonium/canvas-3d': 'file:../canvas.tgz',
        },
      }));
      const args = ['install', '--ignore-workspace', '--offline', '--ignore-scripts', '--strict-peer-dependencies', '--config.auto-install-peers=false'];
      const result = spawn.sync('pnpm', [...args, '--no-frozen-lockfile'], {
        cwd: directory,
        windowsHide: true,
        encoding: 'utf8',
      });
      if (compatible) {
        assert.equal(result.status, 0, result.stdout + result.stderr);
        const lockfile = readFileSync(join(directory, 'pnpm-lock.yaml'), 'utf8');
        const frozen = spawn.sync('pnpm', [...args, '--frozen-lockfile'], {
          cwd: directory,
          windowsHide: true,
          encoding: 'utf8',
        });
        assert.equal(frozen.status, 0, frozen.stdout + frozen.stderr);
        assert.equal(readFileSync(join(directory, 'pnpm-lock.yaml'), 'utf8'), lockfile);
      } else {
        assert.notEqual(result.status, 0);
        assert.match(result.stdout + result.stderr, /ERR_PNPM_PEER_DEP_ISSUES/);
      }
    }
  });

  it('should preserve caret publication after a subsequent Changesets release', () => {
    /// @case
    /// Apply a core patch release with the installed Changesets CLI in a throwaway workspace, then pack editor.
    /// @expect
    /// Workspace ranges remain workspace:^ and the tarball uses the new core version with a caret.
    const fixture = join(temporaryDirectory, 'release');
    mkdirSync(join(fixture, '.changeset'), { recursive: true });
    cpSync(join(root, 'package.json'), join(fixture, 'package.json'));
    cpSync(join(root, 'pnpm-workspace.yaml'), join(fixture, 'pnpm-workspace.yaml'));
    cpSync(join(root, 'pnpm-lock.yaml'), join(fixture, 'pnpm-lock.yaml'));
    const config = JSON.parse(readFileSync(join(root, '.changeset', 'config.json'), 'utf8'));
    writeFileSync(join(fixture, '.changeset', 'config.json'), JSON.stringify({ ...config, changelog: false }));
    writeFileSync(join(fixture, '.changeset', 'core-patch.md'), '---\n"@cyclonium/core": patch\n---\n\nTest subsequent publication.\n');
    for (const pkg of packages) {
      const directory = join(fixture, relative(root, pkg.directory));
      mkdirSync(directory, { recursive: true });
      cpSync(join(pkg.directory, 'package.json'), join(directory, 'package.json'));
    }
    const require = createRequire(import.meta.url);
    execFileSync(process.execPath, [require.resolve('@changesets/cli/bin.js'), 'version'], { cwd: fixture, stdio: 'pipe' });
    const releasedPackages = readPackages(fixture);
    const releasedByName = new Map(releasedPackages.map((pkg) => [pkg.manifest.name, pkg]));
    assert.notEqual(releasedByName.get('@cyclonium/core').manifest.version, packagesByName.get('@cyclonium/core').manifest.version);
    for (const pkg of releasedPackages) {
      for (const field of dependencyFields) {
        for (const [name, range] of Object.entries(pkg.manifest[field] ?? {})) {
          if (releasedByName.has(name)) {
            assert.equal(range, 'workspace:^', `${pkg.manifest.name} ${field}.${name}`);
          }
        }
      }
    }
    const editor = releasedByName.get('@cyclonium/editor');
    const installed = spawn.sync('pnpm', ['install', '--frozen-lockfile', '--offline', '--ignore-scripts'], {
      cwd: fixture,
      windowsHide: true,
      encoding: 'utf8',
    });
    assert.equal(installed.status, 0, installed.stdout + installed.stderr);
    assertPackedRanges(pack(editor.directory, join(temporaryDirectory, 'released-editor.tgz')), releasedByName);
  });
});
