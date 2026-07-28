import { mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  AssetGroupAuthoringStore,
  AssetGroupDelivery,
  AssetGroupEntryKind,
  getAssetGroupAssetDbUrl,
  getAssetPipelineAuthoringPaths,
  loadAssetPipelineAuthoringData,
} from '../src/features/asset-groups/authoring-store.js';

/// @case
/// Project-owned Cyclo Asset Group documents are created, edited, and reloaded.
/// @expect
/// Strict persistence preserves author intent without deriving addresses again.
describe('Cyclo asset group authoring data', () => {
  /// @case
  /// 1. Create Cyclo Asset Settings in a clean project.
  /// 2. Add and reorder groups, move an entry, edit its address, and select a build task.
  /// 3. Reload the authoring model from disk.
  /// @expect
  /// Project-owned UniversalAssets restore the exact authored state and keep the original AssetDB URL independent from the edited address.
  it('persists groups, entries, labels, ordering, and build selection', async () => {
    const projectPath = await mkdtemp(join(tmpdir(), 'cyclo-asset-groups-'));
    const store = await AssetGroupAuthoringStore.create(projectPath);
    const characters = await store.createGroup('Characters');
    const shared = await store.createGroup('Shared');

    expect(characters).toMatchObject({
      includeInBuild: true,
      includeAddressInCatalog: true,
      includeGuidsInCatalog: false,
      includeLabelsInCatalog: true,
      delivery: AssetGroupDelivery.local,
    });

    await store.createLabel('preload');
    const entry = await store.addEntry(characters.id, {
      kind: AssetGroupEntryKind.asset,
      assetUuid: 'character-prefab-uuid',
      assetUrl: 'db://assets/characters/hero.prefab',
    });
    await store.updateEntry(characters.id, entry.id, {
      address: 'characters/hero',
      labels: ['preload'],
    });
    await store.moveEntry(characters.id, entry.id, shared.id, 0);
    await store.moveGroup(shared.id, 0);
    await store.selectBuildTask('web-mobile-release');

    const data = await loadAssetPipelineAuthoringData(projectPath);
    expect(data.groupOrder).toEqual([shared.id, characters.id]);
    expect(data.labels).toEqual(['preload']);
    expect(data.selectedBuildTaskId).toBe('web-mobile-release');
    expect(data.groups[0]?.entries).toEqual([
      expect.objectContaining({
        id: entry.id,
        assetUrl: 'db://assets/characters/hero.prefab',
        address: 'characters/hero',
        labels: ['preload'],
      }),
    ]);

    const paths = getAssetPipelineAuthoringPaths(projectPath);
    expect(getAssetGroupAssetDbUrl(paths, characters))
      .toBe('db://assets/CycloAssetData/AssetGroups/Characters.asset');
    await expect(readFile(paths.settingsFile, 'utf8')).resolves.toContain('cyclo.AssetPipelineSettings');
    await expect(readFile(join(paths.groupsDirectory, 'Characters.asset'), 'utf8'))
      .resolves.toContain('cyclo.AssetGroup');
    await expect(readFile(join(paths.bundleRootsDirectory, 'Characters', 'Anchor.asset'), 'utf8'))
      .resolves.toContain('cyclo.AssetGroupAnchor');
    await expect(readFile(join(paths.bundleRootsDirectory, 'Shared', 'Anchor.asset'), 'utf8'))
      .resolves.toContain('cyclo.AssetGroupAnchor');
  });

  /// @case
  /// 1. Create valid Cyclo Asset Settings.
  /// 2. Replace its declared authoring schema version with an unsupported version.
  /// @expect
  /// Loading rejects the settings instead of interpreting a newer authoring model incorrectly.
  it('rejects an unsupported UniversalAsset authoring schema version', async () => {
    const projectPath = await mkdtemp(join(tmpdir(), 'cyclo-asset-groups-invalid-'));
    await AssetGroupAuthoringStore.create(projectPath);
    const { settingsFile } = getAssetPipelineAuthoringPaths(projectPath);
    const source = await readFile(settingsFile, 'utf8');
    await writeFile(settingsFile, source.replace('"schemaVersion": 1', '"schemaVersion": 2'), 'utf8');

    await expect(loadAssetPipelineAuthoringData(projectPath)).rejects.toThrow('schemaVersion must be 1');
  });

  /// @case
  /// 1. Add an AssetDB directory to a group.
  /// 2. Assign labels and edit the directory address.
  /// 3. Reload the data without expanding the directory.
  /// @expect
  /// The directory remains one explicit entry so the Catalog compiler can expand the current children for every build.
  it('keeps directory entries explicit and preserves their authored address', async () => {
    const projectPath = await mkdtemp(join(tmpdir(), 'cyclo-asset-groups-directory-'));
    const store = await AssetGroupAuthoringStore.create(projectPath);
    const group = await store.createGroup('UI');
    await store.createLabel('ui');
    const directory = await store.addEntry(group.id, {
      kind: AssetGroupEntryKind.directory,
      assetUuid: 'ui-directory-uuid',
      assetUrl: 'db://assets/ui',
    });
    await store.updateEntry(group.id, directory.id, {
      address: 'ui-content',
      labels: ['ui'],
    });

    const data = await loadAssetPipelineAuthoringData(projectPath);
    expect(data.groups[0]?.entries).toEqual([
      expect.objectContaining({
        kind: AssetGroupEntryKind.directory,
        assetUuid: 'ui-directory-uuid',
        assetUrl: 'db://assets/ui',
        address: 'ui-content',
        labels: ['ui'],
      }),
    ]);
  });

  /// @case
  /// 1. Persist a group and remove its generated technical BundleRoot directory.
  /// 2. Open the authoring store again from the version-controlled documents.
  /// @expect
  /// The technical directory and its UniversalAsset Anchor are reconstructed from the group model.
  it('reconstructs missing technical bundle roots and Anchors when the store opens', async () => {
    const projectPath = await mkdtemp(join(tmpdir(), 'cyclo-asset-groups-roots-'));
    const store = await AssetGroupAuthoringStore.create(projectPath);
    const group = await store.createGroup('Rebuilt Root');
    const root = join(getAssetPipelineAuthoringPaths(projectPath).bundleRootsDirectory, group.name);
    await rm(root, { recursive: true });

    await AssetGroupAuthoringStore.open(projectPath);

    await expect(readFile(join(root, 'Anchor.asset'), 'utf8'))
      .resolves.toContain('cyclo.AssetGroupAnchor');
  });

  it('renames the group asset and technical BundleRoot with the authored group name', async () => {
    /// @case
    /// 1. Create a group named Characters.
    /// 2. Rename it to Heroes and reopen the authoring store.
    /// @expect
    /// Both project-visible paths follow the new readable name while the stable group ID and data survive the rename.
    const projectPath = await mkdtemp(join(tmpdir(), 'cyclo-asset-groups-rename-'));
    const store = await AssetGroupAuthoringStore.create(projectPath);
    const group = await store.createGroup('Characters');
    const paths = getAssetPipelineAuthoringPaths(projectPath);

    await store.updateGroup(group.id, { name: 'Heroes' });

    await expect(stat(join(paths.groupsDirectory, 'Characters.asset'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(stat(join(paths.bundleRootsDirectory, 'Characters'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(join(paths.groupsDirectory, 'Heroes.asset'), 'utf8')).resolves.toContain(group.id);
    await expect(readFile(join(paths.bundleRootsDirectory, 'Heroes', 'Anchor.asset'), 'utf8'))
      .resolves.toContain('cyclo.AssetGroupAnchor');
    await expect(AssetGroupAuthoringStore.open(projectPath).then((opened) => opened.snapshot().groups[0]))
      .resolves.toMatchObject({ id: group.id, name: 'Heroes' });
  });

  it('uses readable numeric suffixes when group names would occupy the same paths', async () => {
    /// @case
    /// 1. Create two groups with the same requested name.
    /// 2. Inspect their authored names and project-visible paths.
    /// @expect
    /// The second group is named and stored as Characters 2 instead of exposing either stable UUID.
    const projectPath = await mkdtemp(join(tmpdir(), 'cyclo-asset-groups-duplicate-name-'));
    const store = await AssetGroupAuthoringStore.create(projectPath);
    const first = await store.createGroup('Characters');
    const second = await store.createGroup('Characters');
    const paths = getAssetPipelineAuthoringPaths(projectPath);

    expect(first.name).toBe('Characters');
    expect(second.name).toBe('Characters 2');
    await expect(stat(join(paths.groupsDirectory, 'Characters.asset'))).resolves.toMatchObject({});
    await expect(stat(join(paths.groupsDirectory, 'Characters 2.asset'))).resolves.toMatchObject({});
    await expect(stat(join(paths.bundleRootsDirectory, 'Characters'))).resolves.toMatchObject({});
    await expect(stat(join(paths.bundleRootsDirectory, 'Characters 2'))).resolves.toMatchObject({});
  });

  it('migrates legacy UUID paths when existing authoring data is opened', async () => {
    /// @case
    /// 1. Persist a group using the legacy UUID file and BundleRoot names.
    /// 2. Open the existing authoring data with the readable-path store.
    /// @expect
    /// Both paths migrate to the group name without changing the serialized stable group ID.
    const projectPath = await mkdtemp(join(tmpdir(), 'cyclo-asset-groups-legacy-path-'));
    const store = await AssetGroupAuthoringStore.create(projectPath);
    const group = await store.createGroup('Characters');
    const paths = getAssetPipelineAuthoringPaths(projectPath);
    await rename(
      join(paths.groupsDirectory, 'Characters.asset'),
      join(paths.groupsDirectory, `${group.id}.asset`),
    );
    await rename(
      join(paths.bundleRootsDirectory, 'Characters'),
      join(paths.bundleRootsDirectory, group.id),
    );

    const reopened = await AssetGroupAuthoringStore.open(projectPath);

    await expect(stat(join(paths.groupsDirectory, `${group.id}.asset`))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(stat(join(paths.bundleRootsDirectory, group.id))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(join(paths.groupsDirectory, 'Characters.asset'), 'utf8')).resolves.toContain(group.id);
    await expect(stat(join(paths.bundleRootsDirectory, 'Characters'))).resolves.toMatchObject({});
    expect(reopened.snapshot().groups[0]).toMatchObject({ id: group.id, name: 'Characters' });
  });

  /// @case
  /// 1. Create and edit project-owned Cyclo Asset Settings.
  /// 2. Invoke the first-use creation API again for the same project.
  /// @expect
  /// Creation fails explicitly and the existing authoring documents remain untouched.
  it('refuses to replace existing Cyclo Asset Settings', async () => {
    const projectPath = await mkdtemp(join(tmpdir(), 'cyclo-asset-groups-existing-'));
    const store = await AssetGroupAuthoringStore.create(projectPath);
    const group = await store.createGroup('Keep Me');

    await expect(AssetGroupAuthoringStore.create(projectPath)).rejects.toThrow('already exist');

    const data = await loadAssetPipelineAuthoringData(projectPath);
    expect(data.groupOrder).toEqual([group.id]);
    expect(data.groups[0]?.name).toBe('Keep Me');
  });
});
