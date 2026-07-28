import { randomUUID } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { ensureDir } from 'fs-extra';
import {
  FileSystemAuthoringAssetPersistence,
  type AuthoringAssetPersistence,
} from './authoring-persistence.js';
import { ensureAssetGroupAnchor } from './bundle-anchor.js';
import {
  ASSET_GROUP_CLASS_NAME,
  ASSET_GROUP_ENTRY_CLASS_NAME,
  ASSET_PIPELINE_SETTINGS_CLASS_NAME,
  parseUniversalAssetDocument,
  serializeUniversalAsset,
  type UniversalAssetDocument,
} from './universal-asset-serialization.js';

export enum AssetGroupDelivery {
  local = 'local',
}

export enum AssetGroupEntryKind {
  asset = 'asset',
  subAsset = 'sub-asset',
  directory = 'directory',
}

export interface AssetGroupEntry {
  readonly id: string;
  readonly kind: AssetGroupEntryKind;
  readonly assetUuid: string;
  readonly assetUrl: string;
  readonly address: string;
  readonly labels: readonly string[];
}

export interface AssetGroup {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly name: string;
  readonly includeInBuild: boolean;
  readonly includeAddressInCatalog: boolean;
  readonly includeGuidsInCatalog: boolean;
  readonly includeLabelsInCatalog: boolean;
  readonly delivery: AssetGroupDelivery;
  readonly entries: readonly AssetGroupEntry[];
}

export interface AssetPipelineAuthoringData {
  readonly schemaVersion: 1;
  readonly groupOrder: readonly string[];
  readonly labels: readonly string[];
  readonly selectedBuildTaskId?: string;
  readonly groups: readonly AssetGroup[];
}

export interface NewAssetGroupEntry {
  readonly kind: AssetGroupEntryKind;
  readonly assetUuid: string;
  readonly assetUrl: string;
}

export interface AssetGroupEntryChanges {
  readonly address?: string;
  readonly labels?: readonly string[];
}

export interface AssetGroupChanges {
  readonly name?: string;
  readonly includeInBuild?: boolean;
  readonly includeAddressInCatalog?: boolean;
  readonly includeGuidsInCatalog?: boolean;
  readonly includeLabelsInCatalog?: boolean;
}

interface AssetPipelineSettingsDocument extends UniversalAssetDocument {
  readonly __type__: typeof ASSET_PIPELINE_SETTINGS_CLASS_NAME;
  readonly schemaVersion: 1;
  readonly groupOrder: readonly string[];
  readonly labels: readonly string[];
  readonly selectedBuildTaskId?: string;
}

interface AssetGroupDocument extends UniversalAssetDocument {
  readonly __type__: typeof ASSET_GROUP_CLASS_NAME;
  readonly schemaVersion: 1;
  readonly id: string;
  readonly groupName: string;
  readonly includeInBuild: boolean;
  readonly includeAddressInCatalog: boolean;
  readonly includeGuidsInCatalog: boolean;
  readonly includeLabelsInCatalog: boolean;
  readonly delivery: AssetGroupDelivery;
  readonly entries: readonly AssetGroupEntryDocument[];
}

interface AssetGroupEntryDocument extends UniversalAssetDocument {
  readonly __type__: typeof ASSET_GROUP_ENTRY_CLASS_NAME;
  readonly id: string;
  readonly kind: AssetGroupEntryKind;
  readonly assetUuid: string;
  readonly assetUrl: string;
  readonly address: string;
  readonly labels: readonly string[];
}

export interface AssetPipelineAuthoringPaths {
  readonly rootDirectory: string;
  readonly settingsFile: string;
  readonly settingsAssetDbUrl: string;
  readonly groupsDirectory: string;
  readonly groupsAssetDbUrl: string;
  readonly bundleRootsDirectory: string;
  readonly bundleRootsAssetDbUrl: string;
}

const AUTHORING_DIRECTORY = join('assets', 'CycloAssetData');
const AUTHORING_ASSET_DB_URL = 'db://assets/CycloAssetData';
const GROUP_FILE_EXTENSION = '.asset';
const SETTINGS_FILE_NAME = 'AssetPipelineSettings.asset';
const INVALID_GROUP_STORAGE_NAME_CHARACTERS = '<>:"/\\|?*#%';

export function getAssetPipelineAuthoringPaths(projectPath: string): AssetPipelineAuthoringPaths {
  const rootDirectory = join(projectPath, AUTHORING_DIRECTORY);
  return {
    rootDirectory,
    settingsFile: join(rootDirectory, SETTINGS_FILE_NAME),
    settingsAssetDbUrl: `${AUTHORING_ASSET_DB_URL}/${SETTINGS_FILE_NAME}`,
    groupsDirectory: join(rootDirectory, 'AssetGroups'),
    groupsAssetDbUrl: `${AUTHORING_ASSET_DB_URL}/AssetGroups`,
    bundleRootsDirectory: join(rootDirectory, 'BundleRoots'),
    bundleRootsAssetDbUrl: `${AUTHORING_ASSET_DB_URL}/BundleRoots`,
  };
}

export function getAssetGroupStorageName(groupName: string): string {
  const safeName = Array.from(groupName.trim(), (character) => {
    return character.charCodeAt(0) < 32 || INVALID_GROUP_STORAGE_NAME_CHARACTERS.includes(character)
      ? '-'
      : character;
  })
    .join('')
    .replace(/[. ]+$/g, '');
  if (safeName.length === 0) {
    return 'Asset Group';
  }
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safeName)) {
    return `${safeName} Group`;
  }
  return safeName;
}

export function getAssetGroupAssetDbUrl(
  paths: AssetPipelineAuthoringPaths,
  group: AssetGroup,
): string {
  return `${paths.groupsAssetDbUrl}/${getAssetGroupStorageName(group.name)}${GROUP_FILE_EXTENSION}`;
}

export async function loadAssetPipelineAuthoringData(projectPath: string): Promise<AssetPipelineAuthoringData> {
  const paths = getAssetPipelineAuthoringPaths(projectPath);
  const settings = parseSettingsDocument(await readFile(paths.settingsFile, 'utf8'), paths.settingsFile);
  const files = (await readdir(paths.groupsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(GROUP_FILE_EXTENSION))
    .map((entry) => entry.name)
    .sort();
  const unorderedGroups = await Promise.all(files.map(async (fileName) => {
    const file = join(paths.groupsDirectory, fileName);
    return parseGroupDocument(await readFile(file, 'utf8'), file);
  }));
  validateAuthoringRelationships(settings, unorderedGroups);
  const groupById = new Map(unorderedGroups.map((group) => [group.id, group]));
  const groups = settings.groupOrder.map((groupId) => {
    const group = groupById.get(groupId);
    if (group === undefined) {
      throw new Error(`Cyclo Asset Group does not exist for settings id: ${groupId}`);
    }
    return group;
  });
  return {
    schemaVersion: settings.schemaVersion,
    groupOrder: settings.groupOrder,
    labels: settings.labels,
    ...(settings.selectedBuildTaskId === undefined
      ? {}
      : { selectedBuildTaskId: settings.selectedBuildTaskId }),
    groups,
  };
}

export class AssetGroupAuthoringStore {
  static async create(
    projectPath: string,
    persistence: AuthoringAssetPersistence = new FileSystemAuthoringAssetPersistence(),
  ): Promise<AssetGroupAuthoringStore> {
    const paths = getAssetPipelineAuthoringPaths(projectPath);
    await ensureDir(paths.groupsDirectory);
    await ensureDir(paths.bundleRootsDirectory);
    const initialData: AssetPipelineAuthoringData = {
      schemaVersion: 1,
      groupOrder: [],
      labels: [],
      groups: [],
    };
    try {
      const initialSettings: AssetPipelineSettingsDocument = {
        __type__: ASSET_PIPELINE_SETTINGS_CLASS_NAME,
        schemaVersion: 1,
        groupOrder: [],
        labels: [],
      };
      await persistence.create(
        paths.settingsFile,
        paths.settingsAssetDbUrl,
        serializeUniversalAsset(createSettingsAsset(initialSettings)),
      );
    } catch (error) {
      if (isNodeError(error) && error.code === 'EEXIST') {
        throw new Error(`Cyclo Asset Settings already exist: ${paths.settingsFile}`, { cause: error });
      }
      throw error;
    }
    return new AssetGroupAuthoringStore(paths, initialData, persistence);
  }

  static async open(
    projectPath: string,
    persistence: AuthoringAssetPersistence = new FileSystemAuthoringAssetPersistence(),
  ): Promise<AssetGroupAuthoringStore> {
    const paths = getAssetPipelineAuthoringPaths(projectPath);
    const data = await loadAssetPipelineAuthoringData(projectPath);
    await ensureDir(paths.bundleRootsDirectory);
    await reconcileGroupStorage(paths, data, persistence);
    return new AssetGroupAuthoringStore(paths, data, persistence);
  }

  snapshot(): AssetPipelineAuthoringData {
    return structuredClone(this.#data);
  }

  async createGroup(name: string): Promise<AssetGroup> {
    assertNonEmptyString(name, 'group name');
    const id = randomUUID();
    const availableName = createAvailableGroupName(name, this.#data.groups);
    const group: AssetGroup = {
      schemaVersion: 1,
      id,
      name: availableName,
      includeInBuild: true,
      includeAddressInCatalog: true,
      includeGuidsInCatalog: false,
      includeLabelsInCatalog: true,
      delivery: AssetGroupDelivery.local,
      entries: [],
    };
    const next = {
      ...this.#data,
      groupOrder: [...this.#data.groupOrder, id],
      groups: [...this.#data.groups, group],
    };
    await ensureDir(groupBundleRootPath(this.#paths, group));
    await this.#commit(next);
    return structuredClone(group);
  }

  async updateGroup(groupId: string, changes: AssetGroupChanges): Promise<void> {
    const group = this.#requireGroup(groupId);
    if (changes.name !== undefined) {
      assertNonEmptyString(changes.name, 'group name');
    }
    const updated: AssetGroup = {
      ...group,
      ...changes,
      ...(changes.name === undefined
        ? {}
        : { name: createAvailableGroupName(changes.name, this.#data.groups, groupId) }),
    };
    await this.#replaceGroup(updated);
  }

  async deleteGroup(groupId: string): Promise<void> {
    const group = this.#requireGroup(groupId);
    const next: AssetPipelineAuthoringData = {
      ...this.#data,
      groupOrder: this.#data.groupOrder.filter((id) => id !== groupId),
      groups: this.#data.groups.filter((group) => group.id !== groupId),
    };
    await this.#commit(next);
    await this.#persistence.deleteDirectory(
      groupBundleRootPath(this.#paths, group),
      groupBundleRootAssetDbUrl(this.#paths, group),
    );
  }

  async moveGroup(groupId: string, targetIndex: number): Promise<void> {
    this.#requireGroup(groupId);
    assertIndex(targetIndex, this.#data.groupOrder.length - 1, 'group target index');
    const groupOrder = this.#data.groupOrder.filter((id) => id !== groupId);
    groupOrder.splice(targetIndex, 0, groupId);
    await this.#commit({ ...this.#data, groupOrder });
  }

  async createLabel(label: string): Promise<void> {
    assertNonEmptyString(label, 'label');
    if (this.#data.labels.includes(label)) {
      throw new Error(`Cyclo Asset label already exists: ${label}`);
    }
    await this.#commit({ ...this.#data, labels: [...this.#data.labels, label] });
  }

  async deleteLabel(label: string): Promise<void> {
    if (!this.#data.labels.includes(label)) {
      throw new Error(`Cyclo Asset label does not exist: ${label}`);
    }
    const groups = this.#data.groups.map((group) => ({
      ...group,
      entries: group.entries.map((entry) => ({
        ...entry,
        labels: entry.labels.filter((entryLabel) => entryLabel !== label),
      })),
    }));
    await this.#commit({
      ...this.#data,
      labels: this.#data.labels.filter((existing) => existing !== label),
      groups,
    });
  }

  async addEntry(groupId: string, input: NewAssetGroupEntry): Promise<AssetGroupEntry> {
    assertNonEmptyString(input.assetUuid, 'entry asset UUID');
    assertAssetDbUrl(input.assetUrl);
    const group = this.#requireGroup(groupId);
    const entry: AssetGroupEntry = {
      id: randomUUID(),
      kind: input.kind,
      assetUuid: input.assetUuid,
      assetUrl: input.assetUrl,
      address: input.assetUrl,
      labels: [],
    };
    await this.#replaceGroup({ ...group, entries: [...group.entries, entry] });
    return structuredClone(entry);
  }

  async updateEntry(groupId: string, entryId: string, changes: AssetGroupEntryChanges): Promise<void> {
    const group = this.#requireGroup(groupId);
    const entryIndex = group.entries.findIndex((entry) => entry.id === entryId);
    if (entryIndex < 0) {
      throw new Error(`Cyclo Asset entry does not exist in group ${groupId}: ${entryId}`);
    }
    if (changes.address !== undefined) {
      assertNonEmptyString(changes.address, 'entry address');
    }
    if (changes.labels !== undefined) {
      assertUniqueStrings(changes.labels, 'entry labels');
      for (const label of changes.labels) {
        if (!this.#data.labels.includes(label)) {
          throw new Error(`Cyclo Asset label does not exist: ${label}`);
        }
      }
    }
    const entries = [...group.entries];
    entries[entryIndex] = { ...entries[entryIndex], ...changes };
    await this.#replaceGroup({ ...group, entries });
  }

  async deleteEntry(groupId: string, entryId: string): Promise<void> {
    const group = this.#requireGroup(groupId);
    if (!group.entries.some((entry) => entry.id === entryId)) {
      throw new Error(`Cyclo Asset entry does not exist in group ${groupId}: ${entryId}`);
    }
    await this.#replaceGroup({
      ...group,
      entries: group.entries.filter((entry) => entry.id !== entryId),
    });
  }

  async moveEntry(sourceGroupId: string, entryId: string, targetGroupId: string, targetIndex: number): Promise<void> {
    const source = this.#requireGroup(sourceGroupId);
    const target = this.#requireGroup(targetGroupId);
    const entry = source.entries.find((candidate) => candidate.id === entryId);
    if (entry === undefined) {
      throw new Error(`Cyclo Asset entry does not exist in group ${sourceGroupId}: ${entryId}`);
    }
    const maxIndex = sourceGroupId === targetGroupId ? target.entries.length - 1 : target.entries.length;
    assertIndex(targetIndex, maxIndex, 'entry target index');

    if (sourceGroupId === targetGroupId) {
      const entries = source.entries.filter((candidate) => candidate.id !== entryId);
      entries.splice(targetIndex, 0, entry);
      await this.#replaceGroup({ ...source, entries });
      return;
    }

    const targetEntries = [...target.entries];
    targetEntries.splice(targetIndex, 0, entry);
    const groups = this.#data.groups.map((group) => {
      if (group.id === sourceGroupId) {
        return { ...group, entries: group.entries.filter((candidate) => candidate.id !== entryId) };
      }
      if (group.id === targetGroupId) {
        return { ...group, entries: targetEntries };
      }
      return group;
    });
    await this.#commit({ ...this.#data, groups });
  }

  async selectBuildTask(buildTaskId: string | undefined): Promise<void> {
    if (buildTaskId !== undefined) {
      assertNonEmptyString(buildTaskId, 'build task id');
    }
    await this.#commit({ ...this.#data, selectedBuildTaskId: buildTaskId });
  }

  private constructor(
    paths: AssetPipelineAuthoringPaths,
    data: AssetPipelineAuthoringData,
    persistence: AuthoringAssetPersistence,
  ) {
    this.#paths = paths;
    this.#data = data;
    this.#persistence = persistence;
  }

  readonly #paths: AssetPipelineAuthoringPaths;
  readonly #persistence: AuthoringAssetPersistence;
  #data: AssetPipelineAuthoringData;

  #requireGroup(groupId: string): AssetGroup {
    const group = this.#data.groups.find((candidate) => candidate.id === groupId);
    if (group === undefined) {
      throw new Error(`Cyclo Asset Group does not exist: ${groupId}`);
    }
    return group;
  }

  async #replaceGroup(updated: AssetGroup): Promise<void> {
    await this.#commit({
      ...this.#data,
      groups: this.#data.groups.map((group) => group.id === updated.id ? updated : group),
    });
  }

  async #commit(next: AssetPipelineAuthoringData): Promise<void> {
    validateAuthoringRelationships(next, next.groups);
    await writeAuthoringData(this.#paths, this.#data, next, this.#persistence);
    this.#data = next;
  }
}

async function writeAuthoringData(
  paths: AssetPipelineAuthoringPaths,
  previous: AssetPipelineAuthoringData,
  next: AssetPipelineAuthoringData,
  persistence: AuthoringAssetPersistence,
): Promise<void> {
  await ensureDir(paths.groupsDirectory);
  await ensureDir(paths.bundleRootsDirectory);
  const previousGroups = new Map(previous.groups.map((group) => [group.id, group]));
  const nextGroups = new Map(next.groups.map((group) => [group.id, group]));
  for (const group of next.groups) {
    const previousGroup = previousGroups.get(group.id);
    const file = groupAssetFile(paths, group);
    const assetDbUrl = groupAssetDbUrl(paths, group);
    if (previousGroup !== undefined
      && getAssetGroupStorageName(previousGroup.name) !== getAssetGroupStorageName(group.name)) {
      await persistence.move(
        groupAssetFile(paths, previousGroup),
        groupAssetDbUrl(paths, previousGroup),
        file,
        assetDbUrl,
      );
      await persistence.move(
        groupBundleRootPath(paths, previousGroup),
        groupBundleRootAssetDbUrl(paths, previousGroup),
        groupBundleRootPath(paths, group),
        groupBundleRootAssetDbUrl(paths, group),
      );
    }
    await ensureAssetGroupAnchor(
      paths,
      getAssetGroupStorageName(group.name),
      persistence,
    );
    if (previousGroup !== undefined && equalAuthoringValue(previousGroup, group)) {
      continue;
    }
    const contents = serializeUniversalAsset(createGroupAsset(group));
    if (previousGroup === undefined) {
      await persistence.create(file, assetDbUrl, contents);
    } else {
      await persistence.save(file, assetDbUrl, contents);
    }
  }

  for (const group of previous.groups) {
    if (!nextGroups.has(group.id)) {
      await persistence.delete(
        groupAssetFile(paths, group),
        groupAssetDbUrl(paths, group),
      );
    }
  }

  const settings: AssetPipelineSettingsDocument = {
    __type__: ASSET_PIPELINE_SETTINGS_CLASS_NAME,
    schemaVersion: 1,
    groupOrder: next.groupOrder,
    labels: next.labels,
    ...(next.selectedBuildTaskId === undefined ? {} : { selectedBuildTaskId: next.selectedBuildTaskId }),
  };
  if (!equalSettings(previous, next)) {
    await persistence.save(
      paths.settingsFile,
      paths.settingsAssetDbUrl,
      serializeUniversalAsset(createSettingsAsset(settings)),
    );
  }
}

function createSettingsAsset(settings: AssetPipelineSettingsDocument): AssetPipelineSettingsDocument {
  return {
    __type__: ASSET_PIPELINE_SETTINGS_CLASS_NAME,
    schemaVersion: settings.schemaVersion,
    groupOrder: [...settings.groupOrder],
    labels: [...settings.labels],
    selectedBuildTaskId: settings.selectedBuildTaskId ?? '',
  };
}

function createGroupAsset(group: AssetGroup): AssetGroupDocument {
  return {
    __type__: ASSET_GROUP_CLASS_NAME,
    schemaVersion: group.schemaVersion,
    id: group.id,
    groupName: group.name,
    includeInBuild: group.includeInBuild,
    includeAddressInCatalog: group.includeAddressInCatalog,
    includeGuidsInCatalog: group.includeGuidsInCatalog,
    includeLabelsInCatalog: group.includeLabelsInCatalog,
    delivery: group.delivery,
    entries: group.entries.map((entry) => ({
      __type__: ASSET_GROUP_ENTRY_CLASS_NAME,
      id: entry.id,
      kind: entry.kind,
      assetUuid: entry.assetUuid,
      assetUrl: entry.assetUrl,
      address: entry.address,
      labels: [...entry.labels],
    })),
  };
}

function parseSettingsDocument(source: string, file: string): AssetPipelineSettingsDocument {
  const value = parseUniversalAssetDocument(source, ASSET_PIPELINE_SETTINGS_CLASS_NAME, file);
  assertSchemaVersion(value.schemaVersion, file);
  const groupOrder = readStringArray(value.groupOrder, `${file}.groupOrder`);
  const labels = readStringArray(value.labels, `${file}.labels`);
  assertUniqueStrings(groupOrder, `${file}.groupOrder`);
  assertUniqueStrings(labels, `${file}.labels`);
  const selectedBuildTaskId = value.selectedBuildTaskId;
  if (typeof selectedBuildTaskId !== 'string') {
    throw new Error(`${file}.selectedBuildTaskId must be a string`);
  }
  if (selectedBuildTaskId.length > 0) {
    assertNonEmptyString(selectedBuildTaskId, `${file}.selectedBuildTaskId`);
  }
  return {
    __type__: ASSET_PIPELINE_SETTINGS_CLASS_NAME,
    schemaVersion: 1,
    groupOrder,
    labels,
    ...(selectedBuildTaskId.length === 0 ? {} : { selectedBuildTaskId }),
  };
}

function parseGroupDocument(source: string, file: string): AssetGroup {
  const value = parseUniversalAssetDocument(source, ASSET_GROUP_CLASS_NAME, file);
  assertSchemaVersion(value.schemaVersion, file);
  assertNonEmptyString(value.id, `${file}.id`);
  assertNonEmptyString(value.groupName, `${file}.groupName`);
  assertBoolean(value.includeInBuild, `${file}.includeInBuild`);
  assertBoolean(value.includeAddressInCatalog, `${file}.includeAddressInCatalog`);
  assertBoolean(value.includeGuidsInCatalog, `${file}.includeGuidsInCatalog`);
  assertBoolean(value.includeLabelsInCatalog, `${file}.includeLabelsInCatalog`);
  if (value.delivery !== AssetGroupDelivery.local) {
    throw new Error(`${file}.delivery must be ${AssetGroupDelivery.local}`);
  }
  if (!Array.isArray(value.entries)) {
    throw new Error(`${file}.entries must be an array`);
  }
  const entries = value.entries.map((entry, index) => parseEntry(entry, `${file}.entries[${index}]`));
  assertUniqueStrings(entries.map((entry) => entry.id), `${file}.entries ids`);
  return {
    schemaVersion: 1,
    id: value.id,
    name: value.groupName,
    includeInBuild: value.includeInBuild,
    includeAddressInCatalog: value.includeAddressInCatalog,
    includeGuidsInCatalog: value.includeGuidsInCatalog,
    includeLabelsInCatalog: value.includeLabelsInCatalog,
    delivery: value.delivery,
    entries,
  };
}

function parseEntry(value: unknown, field: string): AssetGroupEntry {
  if (!isRecord(value) || value.__type__ !== ASSET_GROUP_ENTRY_CLASS_NAME) {
    throw new Error(`${field} must be an AssetGroupEntry`);
  }
  assertNonEmptyString(value.id, `${field}.id`);
  if (!Object.values(AssetGroupEntryKind).includes(value.kind as AssetGroupEntryKind)) {
    throw new Error(`${field}.kind is invalid: ${String(value.kind)}`);
  }
  assertNonEmptyString(value.assetUuid, `${field}.assetUuid`);
  assertAssetDbUrl(value.assetUrl, `${field}.assetUrl`);
  assertNonEmptyString(value.address, `${field}.address`);
  const labels = readStringArray(value.labels, `${field}.labels`);
  assertUniqueStrings(labels, `${field}.labels`);
  return {
    id: value.id,
    kind: value.kind as AssetGroupEntryKind,
    assetUuid: value.assetUuid,
    assetUrl: value.assetUrl,
    address: value.address,
    labels,
  };
}

function validateAuthoringRelationships(
  settings: Pick<AssetPipelineAuthoringData, 'groupOrder' | 'labels'>,
  groups: readonly AssetGroup[],
): void {
  assertUniqueStrings(settings.groupOrder, 'groupOrder');
  assertUniqueStrings(settings.labels, 'labels');
  const groupIds = groups.map((group) => group.id);
  assertUniqueStrings(groupIds, 'group ids');
  assertUniqueStrings(
    groups.map((group) => getAssetGroupStorageName(group.name).toLocaleLowerCase()),
    'group storage names',
  );
  if (!equalStringArrays([...settings.groupOrder].sort(), [...groupIds].sort())) {
    throw new Error('Cyclo Asset Group ids do not match settings groupOrder');
  }
  const entryIds: string[] = [];
  for (const group of groups) {
    for (const entry of group.entries) {
      entryIds.push(entry.id);
      for (const label of entry.labels) {
        if (!settings.labels.includes(label)) {
          throw new Error(`Cyclo Asset entry ${entry.id} refers to unknown label: ${label}`);
        }
      }
    }
  }
  assertUniqueStrings(entryIds, 'entry ids');
}

function assertSchemaVersion(value: unknown, file: string): asserts value is 1 {
  if (value !== 1) {
    throw new Error(`${file}.schemaVersion must be 1`);
  }
}

function assertBoolean(value: unknown, field: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${field} must be a boolean`);
  }
}

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
}

function assertAssetDbUrl(value: unknown, field = 'entry asset URL'): asserts value is string {
  assertNonEmptyString(value, field);
  if (!value.startsWith('db://')) {
    throw new Error(`${field} must be an AssetDB URL: ${value}`);
  }
}

function readStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  for (const [index, item] of value.entries()) {
    assertNonEmptyString(item, `${field}[${index}]`);
  }
  return value as string[];
}

function assertUniqueStrings(values: readonly string[], field: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`${field} contains duplicate value: ${value}`);
    }
    seen.add(value);
  }
}

function assertIndex(value: number, maximum: number, field: string): void {
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${field} must be an integer between 0 and ${maximum}`);
  }
}

function equalStringArrays(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function equalSettings(previous: AssetPipelineAuthoringData, next: AssetPipelineAuthoringData): boolean {
  return equalStringArrays(previous.groupOrder, next.groupOrder)
    && equalStringArrays(previous.labels, next.labels)
    && previous.selectedBuildTaskId === next.selectedBuildTaskId;
}

function equalAuthoringValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function reconcileGroupStorage(
  paths: AssetPipelineAuthoringPaths,
  data: AssetPipelineAuthoringData,
  persistence: AuthoringAssetPersistence,
): Promise<void> {
  const groupFiles = (await readdir(paths.groupsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(GROUP_FILE_EXTENSION))
    .map((entry) => entry.name);
  const fileNameByGroupId = new Map<string, string>();
  for (const fileName of groupFiles) {
    const file = join(paths.groupsDirectory, fileName);
    const group = parseGroupDocument(await readFile(file, 'utf8'), file);
    fileNameByGroupId.set(group.id, fileName);
  }

  for (const group of data.groups) {
    const currentFileName = fileNameByGroupId.get(group.id);
    if (currentFileName === undefined) {
      throw new Error(`Cyclo Asset Group file is missing for id: ${group.id}`);
    }
    const expectedFile = groupAssetFile(paths, group);
    if (currentFileName !== basename(expectedFile)) {
      await persistence.move(
        join(paths.groupsDirectory, currentFileName),
        `${paths.groupsAssetDbUrl}/${currentFileName}`,
        expectedFile,
        groupAssetDbUrl(paths, group),
      );
    }

    const expectedRoot = groupBundleRootPath(paths, group);
    const legacyRoot = join(paths.bundleRootsDirectory, group.id);
    if (!await pathExists(expectedRoot)) {
      if (await pathExists(legacyRoot)) {
        await persistence.move(
          legacyRoot,
          `${paths.bundleRootsAssetDbUrl}/${group.id}`,
          expectedRoot,
          groupBundleRootAssetDbUrl(paths, group),
        );
      } else {
        await ensureDir(expectedRoot);
      }
    }
    await ensureAssetGroupAnchor(
      paths,
      getAssetGroupStorageName(group.name),
      persistence,
    );
  }
}

function createAvailableGroupName(
  requestedName: string,
  groups: readonly AssetGroup[],
  excludedGroupId?: string,
): string {
  const baseName = requestedName.trim();
  const occupiedStorageNames = new Set(groups
    .filter((group) => group.id !== excludedGroupId)
    .map((group) => getAssetGroupStorageName(group.name).toLocaleLowerCase()));
  let candidate = baseName;
  let suffix = 2;
  while (occupiedStorageNames.has(getAssetGroupStorageName(candidate).toLocaleLowerCase())) {
    candidate = `${baseName} ${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function groupAssetFile(paths: AssetPipelineAuthoringPaths, group: AssetGroup): string {
  return join(paths.groupsDirectory, `${getAssetGroupStorageName(group.name)}${GROUP_FILE_EXTENSION}`);
}

function groupAssetDbUrl(paths: AssetPipelineAuthoringPaths, group: AssetGroup): string {
  return getAssetGroupAssetDbUrl(paths, group);
}

function groupBundleRootPath(paths: AssetPipelineAuthoringPaths, group: AssetGroup): string {
  return join(paths.bundleRootsDirectory, getAssetGroupStorageName(group.name));
}

function groupBundleRootAssetDbUrl(paths: AssetPipelineAuthoringPaths, group: AssetGroup): string {
  return `${paths.bundleRootsAssetDbUrl}/${getAssetGroupStorageName(group.name)}`;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}
