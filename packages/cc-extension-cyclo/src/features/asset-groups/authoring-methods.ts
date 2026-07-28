import { access } from 'node:fs/promises';
import {
  AssetGroupAuthoringStore,
  AssetGroupEntryKind,
  getAssetGroupAssetDbUrl,
  getAssetPipelineAuthoringPaths,
  type AssetGroupChanges,
  type AssetGroupEntryChanges,
  type AssetPipelineAuthoringData,
} from './authoring-store.js';
import { AssetDbAuthoringAssetPersistence } from './authoring-persistence.js';
import {
  AssetGroupDiagnosticSeverity,
  type AssetGroupDiagnostic,
  type AssetGroupPanelState,
  type AssetGroupsAuthoringMethods,
} from './panel-contract.js';

export const assetGroupsAuthoringMethods: AssetGroupsAuthoringMethods = {
  async getAssetGroupPanelState(): Promise<AssetGroupPanelState> {
    return readPanelState();
  },

  async createAssetPipelineSettings(): Promise<AssetGroupPanelState> {
    await AssetGroupAuthoringStore.create(Editor.Project.path, createPersistence());
    return readPanelState();
  },

  async createAssetGroup(name: string): Promise<AssetGroupPanelState> {
    const store = await openStore();
    await store.createGroup(name);
    return readPanelState();
  },

  async updateAssetGroup(groupId: string, changes: AssetGroupChanges): Promise<AssetGroupPanelState> {
    const store = await openStore();
    await store.updateGroup(groupId, changes);
    return readPanelState();
  },

  async deleteAssetGroup(groupId: string): Promise<AssetGroupPanelState> {
    const store = await openStore();
    await store.deleteGroup(groupId);
    return readPanelState();
  },

  async moveAssetGroup(groupId: string, targetIndex: number): Promise<AssetGroupPanelState> {
    const store = await openStore();
    await store.moveGroup(groupId, targetIndex);
    return readPanelState();
  },

  async inspectAssetGroup(groupId: string): Promise<void> {
    const store = await openStore();
    const group = store.snapshot().groups.find((candidate) => candidate.id === groupId);
    if (group === undefined) {
      throw new Error(`Cyclo Asset Group does not exist: ${groupId}`);
    }
    const assetDbUrl = getAssetGroupAssetDbUrl(
      getAssetPipelineAuthoringPaths(Editor.Project.path),
      group,
    );
    const info = await Editor.Message.request('asset-db', 'query-asset-info', assetDbUrl);
    if (info === null) {
      throw new Error(`Cyclo Asset Group is not imported by AssetDB: ${assetDbUrl}`);
    }
    Editor.Selection.clear('asset');
    Editor.Selection.select('asset', info.uuid);
    Editor.Message.send('assets', 'twinkle', info.uuid);
  },

  async createAssetGroupLabel(label: string): Promise<AssetGroupPanelState> {
    const store = await openStore();
    await store.createLabel(label);
    return readPanelState();
  },

  async deleteAssetGroupLabel(label: string): Promise<AssetGroupPanelState> {
    const store = await openStore();
    await store.deleteLabel(label);
    return readPanelState();
  },

  async addAssetGroupEntries(groupId: string, assetUuids: readonly string[]): Promise<AssetGroupPanelState> {
    if (assetUuids.length === 0) {
      throw new Error('At least one AssetDB UUID is required');
    }
    const infos = await Promise.all(assetUuids.map(async (uuid) => {
      const info = await Editor.Message.request('asset-db', 'query-asset-info', uuid);
      if (info === null) {
        throw new Error(`AssetDB resource does not exist: ${uuid}`);
      }
      return info;
    }));
    const store = await openStore();
    for (const info of infos) {
      await store.addEntry(groupId, {
        kind: info.isDirectory
          ? AssetGroupEntryKind.directory
          : info.fatherInfo === undefined
            ? AssetGroupEntryKind.asset
            : AssetGroupEntryKind.subAsset,
        assetUuid: info.uuid,
        assetUrl: info.url,
      });
    }
    return readPanelState();
  },

  async updateAssetGroupEntry(
    groupId: string,
    entryId: string,
    changes: AssetGroupEntryChanges,
  ): Promise<AssetGroupPanelState> {
    const store = await openStore();
    await store.updateEntry(groupId, entryId, changes);
    return readPanelState();
  },

  async deleteAssetGroupEntry(groupId: string, entryId: string): Promise<AssetGroupPanelState> {
    const store = await openStore();
    await store.deleteEntry(groupId, entryId);
    return readPanelState();
  },

  async moveAssetGroupEntry(
    sourceGroupId: string,
    entryId: string,
    targetGroupId: string,
    targetIndex: number,
  ): Promise<AssetGroupPanelState> {
    const store = await openStore();
    await store.moveEntry(sourceGroupId, entryId, targetGroupId, targetIndex);
    return readPanelState();
  },

  async selectCycloBuildTask(buildTaskId: string | undefined): Promise<AssetGroupPanelState> {
    const store = await openStore();
    await store.selectBuildTask(buildTaskId);
    return readPanelState();
  },
};

async function openStore(): Promise<AssetGroupAuthoringStore> {
  return AssetGroupAuthoringStore.open(Editor.Project.path, createPersistence());
}

function createPersistence(): AssetDbAuthoringAssetPersistence {
  return new AssetDbAuthoringAssetPersistence();
}

async function readPanelState(): Promise<AssetGroupPanelState> {
  if (!(await settingsExist())) {
    return {
      configured: false,
      diagnostics: [],
    };
  }
  const data = (await openStore()).snapshot();
  return {
    configured: true,
    data,
    diagnostics: await collectDiagnostics(data),
  };
}

async function settingsExist(): Promise<boolean> {
  try {
    await access(getAssetPipelineAuthoringPaths(Editor.Project.path).settingsFile);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function collectDiagnostics(data: AssetPipelineAuthoringData): Promise<readonly AssetGroupDiagnostic[]> {
  const diagnostics: AssetGroupDiagnostic[] = [];
  const addresses = new Map<string, Array<{ groupId: string; entryId: string }>>();
  const assets = new Map<string, Array<{ groupId: string; entryId: string }>>();
  for (const group of data.groups) {
    for (const entry of group.entries) {
      if (group.includeAddressInCatalog) {
        const locations = addresses.get(entry.address) ?? [];
        locations.push({ groupId: group.id, entryId: entry.id });
        addresses.set(entry.address, locations);
      }
      const occurrences = assets.get(entry.assetUuid) ?? [];
      occurrences.push({ groupId: group.id, entryId: entry.id });
      assets.set(entry.assetUuid, occurrences);

      const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', entry.assetUuid);
      if (assetInfo === null) {
        diagnostics.push({
          severity: AssetGroupDiagnosticSeverity.error,
          code: 'missing-asset',
          message: `Missing AssetDB resource: ${entry.assetUrl} (${entry.assetUuid})`,
          groupId: group.id,
          entryId: entry.id,
        });
      }
    }
  }

  for (const [address, locations] of addresses) {
    if (locations.length > 1) {
      diagnostics.push({
        severity: AssetGroupDiagnosticSeverity.warning,
        code: 'duplicate-address',
        message: `Address ${address} is authored by ${locations.length} entries; Catalog order will select the first location for loadAsset().`,
        groupId: locations[0]?.groupId,
        entryId: locations[0]?.entryId,
      });
    }
  }
  for (const [assetUuid, locations] of assets) {
    if (locations.length > 1) {
      diagnostics.push({
        severity: AssetGroupDiagnosticSeverity.warning,
        code: 'duplicate-explicit-entry',
        message: `Asset ${assetUuid} is explicitly covered by ${locations.length} entries.`,
        groupId: locations[0]?.groupId,
        entryId: locations[0]?.entryId,
      });
    }
  }
  if (diagnostics.length === 0) {
    diagnostics.push({
      severity: AssetGroupDiagnosticSeverity.info,
      code: 'authoring-valid',
      message: 'No authoring diagnostics.',
    });
  }
  return diagnostics;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
