import type {
  AssetGroup,
  AssetGroupChanges,
  AssetGroupEntryChanges,
  AssetPipelineAuthoringData,
} from './authoring-store.js';

export enum AssetGroupDiagnosticSeverity {
  info = 'info',
  warning = 'warning',
  error = 'error',
}

export interface AssetGroupDiagnostic {
  readonly severity: AssetGroupDiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly groupId?: string;
  readonly entryId?: string;
}

export interface AssetGroupPanelState {
  readonly configured: boolean;
  readonly data?: AssetPipelineAuthoringData;
  readonly diagnostics: readonly AssetGroupDiagnostic[];
}

export interface CycloBuildTaskOption {
  readonly id: string;
  readonly label: string;
  readonly platform: string;
}

export interface AssetGroupsExtensionMethods {
  getAssetGroupPanelState(): Promise<AssetGroupPanelState>;
  createAssetPipelineSettings(): Promise<AssetGroupPanelState>;
  createAssetGroup(name: string): Promise<AssetGroupPanelState>;
  updateAssetGroup(groupId: string, changes: AssetGroupChanges): Promise<AssetGroupPanelState>;
  deleteAssetGroup(groupId: string): Promise<AssetGroupPanelState>;
  moveAssetGroup(groupId: string, targetIndex: number): Promise<AssetGroupPanelState>;
  inspectAssetGroup(groupId: string): Promise<void>;
  createAssetGroupLabel(label: string): Promise<AssetGroupPanelState>;
  deleteAssetGroupLabel(label: string): Promise<AssetGroupPanelState>;
  addAssetGroupEntries(groupId: string, assetUuids: readonly string[]): Promise<AssetGroupPanelState>;
  updateAssetGroupEntry(
    groupId: string,
    entryId: string,
    changes: AssetGroupEntryChanges,
  ): Promise<AssetGroupPanelState>;
  deleteAssetGroupEntry(groupId: string, entryId: string): Promise<AssetGroupPanelState>;
  moveAssetGroupEntry(
    sourceGroupId: string,
    entryId: string,
    targetGroupId: string,
    targetIndex: number,
  ): Promise<AssetGroupPanelState>;
  selectCycloBuildTask(buildTaskId: string | undefined): Promise<AssetGroupPanelState>;
  queryCycloBuildTasks(): Promise<readonly CycloBuildTaskOption[]>;
  buildCycloContent(buildTaskId: string): Promise<void>;
}

export type AssetGroupsAuthoringMethods = Omit<
  AssetGroupsExtensionMethods,
  'queryCycloBuildTasks' | 'buildCycloContent'
>;

export type { AssetGroup, AssetGroupChanges, AssetGroupEntryChanges };
