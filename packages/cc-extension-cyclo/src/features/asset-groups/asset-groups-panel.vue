<script setup lang="ts">
/* global Editor */
import { computed, onMounted, ref, watch } from 'vue';
import {
  VAlert,
  VApp,
  VBtn,
  VCard,
  VCardText,
  VCardTitle,
  VChip,
  VDivider,
  VList,
  VListItem,
  VMain,
  VProgressLinear,
  VSelect,
  VTextField,
  VToolbar,
  VToolbarTitle,
} from 'vuetify/components';
import { selfExtensionName } from '../../self-info.js';
import type {
  AssetGroupPanelState,
  AssetGroupsExtensionMethods,
  CycloBuildTaskOption,
} from './panel-contract.js';

const panelState = ref<AssetGroupPanelState>({
  configured: false,
  diagnostics: [],
});
const buildTasks = ref<readonly CycloBuildTaskOption[]>([]);
const selectedGroupId = ref<string>();
const groupNameDraft = ref('');
const newGroupName = ref('');
const newLabel = ref('');
const busy = ref(false);
const errorMessage = ref<string>();
const noticeMessage = ref<string>();

const authoringData = computed(() => panelState.value.data);
const groups = computed(() => authoringData.value?.groups ?? []);
const selectedGroup = computed(() => groups.value.find((group) => group.id === selectedGroupId.value));
const selectedGroupIndex = computed(() => groups.value.findIndex((group) => group.id === selectedGroupId.value));
const selectedBuildTaskId = computed(() => authoringData.value?.selectedBuildTaskId);
const buildTaskItems = computed(() => buildTasks.value.map((task) => ({
  title: `${task.label} · ${task.platform}`,
  value: task.id,
})));
const groupItems = computed(() => groups.value.map((group) => ({
  title: group.name,
  value: group.id,
})));

watch(selectedGroup, (group) => {
  groupNameDraft.value = group?.name ?? '';
  if (group !== undefined) {
    void inspectSelectedGroup(group.id);
  }
});

watch(groups, (nextGroups) => {
  if (nextGroups.length === 0) {
    selectedGroupId.value = undefined;
  } else if (!nextGroups.some((group) => group.id === selectedGroupId.value)) {
    selectedGroupId.value = nextGroups[0]?.id;
  }
}, { immediate: true });

onMounted(async () => {
  await run(async () => {
    const [state, tasks] = await Promise.all([
      invokeExtension('getAssetGroupPanelState'),
      invokeExtension('queryCycloBuildTasks'),
    ]);
    panelState.value = state;
    buildTasks.value = tasks;
  });
});

async function createSettings(): Promise<void> {
  await mutate('createAssetPipelineSettings');
}

async function createGroup(): Promise<void> {
  const name = newGroupName.value.trim();
  if (name.length === 0) {
    errorMessage.value = 'Group name is required.';
    return;
  }
  await mutate('createAssetGroup', name);
  newGroupName.value = '';
  selectedGroupId.value = panelState.value.data?.groups.at(-1)?.id;
}

async function saveGroupName(): Promise<void> {
  const group = requireSelectedGroup();
  await mutate('updateAssetGroup', group.id, { name: groupNameDraft.value });
}

async function deleteSelectedGroup(): Promise<void> {
  const group = requireSelectedGroup();
  await mutate('deleteAssetGroup', group.id);
}

async function inspectSelectedGroup(groupId: string): Promise<void> {
  try {
    await invokeExtension('inspectAssetGroup', groupId);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  }
}

async function moveSelectedGroup(offset: number): Promise<void> {
  const group = requireSelectedGroup();
  await mutate('moveAssetGroup', group.id, selectedGroupIndex.value + offset);
}

async function createLabel(): Promise<void> {
  const label = newLabel.value.trim();
  if (label.length === 0) {
    errorMessage.value = 'Label is required.';
    return;
  }
  await mutate('createAssetGroupLabel', label);
  newLabel.value = '';
}

async function deleteLabel(label: string): Promise<void> {
  await mutate('deleteAssetGroupLabel', label);
}

async function updateEntryAddress(entryId: string, event: Event): Promise<void> {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    throw new Error('Entry address change did not originate from an input element');
  }
  const group = requireSelectedGroup();
  const entry = group.entries.find((candidate) => candidate.id === entryId);
  if (entry === undefined || entry.address === target.value) {
    return;
  }
  await mutate('updateAssetGroupEntry', group.id, entryId, { address: target.value });
}

async function updateEntryLabels(entryId: string, labels: readonly string[]): Promise<void> {
  const group = requireSelectedGroup();
  await mutate('updateAssetGroupEntry', group.id, entryId, { labels });
}

async function deleteEntry(entryId: string): Promise<void> {
  const group = requireSelectedGroup();
  await mutate('deleteAssetGroupEntry', group.id, entryId);
}

async function moveEntry(entryId: string, targetGroupId: string): Promise<void> {
  const source = requireSelectedGroup();
  if (source.id === targetGroupId) {
    return;
  }
  const target = groups.value.find((group) => group.id === targetGroupId);
  if (target === undefined) {
    throw new Error(`Target group does not exist: ${targetGroupId}`);
  }
  await mutate('moveAssetGroupEntry', source.id, entryId, targetGroupId, target.entries.length);
}

async function selectBuildTask(buildTaskId: string | undefined): Promise<void> {
  await mutate('selectCycloBuildTask', buildTaskId);
}

async function buildContent(): Promise<void> {
  const buildTaskId = selectedBuildTaskId.value;
  if (buildTaskId === undefined) {
    errorMessage.value = 'Select a Cocos Build Task first.';
    return;
  }
  await run(async () => {
    await invokeExtension('buildCycloContent', buildTaskId);
    noticeMessage.value = 'Cyclo content build completed.';
    panelState.value = await invokeExtension('getAssetGroupPanelState');
  });
}

async function onEntriesDrop(event: DragEvent): Promise<void> {
  event.preventDefault();
  const group = requireSelectedGroup();
  const dataTransfer = event.dataTransfer;
  if (dataTransfer === null) {
    throw new Error('Asset drop does not contain DataTransfer data');
  }
  const assetUuids = readDroppedAssetUuids(dataTransfer);
  await mutate('addAssetGroupEntries', group.id, assetUuids);
}

function readDroppedAssetUuids(dataTransfer: DataTransfer): readonly string[] {
  const values: string[] = [];
  const primaryValue = dataTransfer.getData('value');
  if (primaryValue.length > 0) {
    values.push(primaryValue);
  }
  const additionalSource = dataTransfer.getData('additional');
  if (additionalSource.length > 0) {
    const additional: unknown = JSON.parse(additionalSource);
    const entries = Array.isArray(additional) ? additional : [additional];
    for (const entry of entries) {
      if (typeof entry !== 'object' || entry === null || !('value' in entry) || typeof entry.value !== 'string') {
        throw new Error('Asset drop additional data is invalid');
      }
      values.push(entry.value);
    }
  }
  const unique = [...new Set(values.filter((value) => value.length > 0))];
  if (unique.length === 0) {
    throw new Error('Drop resources, sub-resources, or directories from the Cocos Assets panel.');
  }
  return unique;
}

function requireSelectedGroup() {
  const group = selectedGroup.value;
  if (group === undefined) {
    throw new Error('Select an Asset Group first');
  }
  return group;
}

async function mutate<TKey extends keyof AssetGroupsExtensionMethods>(
  method: TKey,
  ...args: Parameters<AssetGroupsExtensionMethods[TKey]>
): Promise<void> {
  await run(async () => {
    panelState.value = await invokeExtension(method, ...args) as AssetGroupPanelState;
  });
}

async function run(action: () => Promise<void>): Promise<void> {
  busy.value = true;
  errorMessage.value = undefined;
  noticeMessage.value = undefined;
  try {
    await action();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    busy.value = false;
  }
}

async function invokeExtension<TKey extends keyof AssetGroupsExtensionMethods>(
  method: TKey,
  ...args: Parameters<AssetGroupsExtensionMethods[TKey]>
): Promise<Awaited<ReturnType<AssetGroupsExtensionMethods[TKey]>>> {
  const request = Editor.Message.request as (
    channel: string,
    method: string,
    ...args: unknown[]
  ) => Promise<unknown>;
  return await request(selfExtensionName, method, ...args) as Awaited<ReturnType<AssetGroupsExtensionMethods[TKey]>>;
}
</script>

<template>
  <VApp class="asset-groups-app">
    <VMain>
      <VProgressLinear
        v-if="busy"
        class="busy-indicator"
        color="primary"
        indeterminate
      />

      <VToolbar density="compact">
        <VToolbarTitle>Cyclo Asset Groups</VToolbarTitle>
        <VSelect
          v-if="panelState.configured"
          class="build-task-select"
          label="Cocos Build Task"
          :items="buildTaskItems"
          :model-value="selectedBuildTaskId"
          hide-details
          @update:model-value="selectBuildTask"
        />
        <VBtn
          v-if="panelState.configured"
          :disabled="selectedBuildTaskId === undefined || busy"
          variant="flat"
          color="primary"
          @click="buildContent"
        >
          Build Cyclo Content
        </VBtn>
      </VToolbar>

      <VAlert
        v-if="errorMessage"
        class="status-alert"
        type="error"
        closable
        @click:close="errorMessage = undefined"
      >
        {{ errorMessage }}
      </VAlert>
      <VAlert
        v-if="noticeMessage"
        class="status-alert"
        type="success"
        closable
        @click:close="noticeMessage = undefined"
      >
        {{ noticeMessage }}
      </VAlert>

      <div
        v-if="!panelState.configured"
        class="empty-state"
      >
        <h2>Cyclo Asset Settings have not been created.</h2>
        <p>Create project-owned Groups data under assets/CycloAssetData.</p>
        <VBtn
          color="primary"
          size="large"
          :disabled="busy"
          @click="createSettings"
        >
          Create Cyclo Asset Settings
        </VBtn>
      </div>

      <div
        v-else
        class="workspace"
      >
        <VCard class="groups-pane">
          <VCardTitle>Groups</VCardTitle>
          <VCardText class="group-create-row">
            <VTextField
              v-model="newGroupName"
              label="New group"
              hide-details
              @keydown.enter="createGroup"
            />
            <VBtn
              :disabled="busy"
              @click="createGroup"
            >
              Add
            </VBtn>
          </VCardText>
          <VDivider />
          <VList
            :selected="selectedGroupId === undefined ? [] : [selectedGroupId]"
            mandatory
            @update:selected="selectedGroupId = $event[0]"
          >
            <VListItem
              v-for="group in groups"
              :key="group.id"
              :value="group.id"
              :title="group.name"
              :subtitle="`${group.entries.length} entries`"
            />
          </VList>
          <div class="group-order-actions">
            <VBtn
              size="small"
              :disabled="selectedGroupIndex <= 0 || busy"
              @click="moveSelectedGroup(-1)"
            >
              Move Up
            </VBtn>
            <VBtn
              size="small"
              :disabled="selectedGroupIndex < 0 || selectedGroupIndex >= groups.length - 1 || busy"
              @click="moveSelectedGroup(1)"
            >
              Move Down
            </VBtn>
          </div>
        </VCard>

        <VCard class="entries-pane">
          <template v-if="selectedGroup">
            <VCardTitle class="selected-group-title">
              <VTextField
                v-model="groupNameDraft"
                label="Group name"
                hide-details
                @keydown.enter="saveGroupName"
              />
              <VBtn @click="saveGroupName">
                Rename
              </VBtn>
              <VBtn
                color="error"
                variant="text"
                @click="deleteSelectedGroup"
              >
                Delete Group
              </VBtn>
            </VCardTitle>
            <VCardText>
              <div
                class="asset-drop-zone"
                @dragover.prevent
                @drop="onEntriesDrop"
              >
                Drop resources, sub-resources, or directories from the Assets panel
              </div>

              <div
                v-for="entry in selectedGroup.entries"
                :key="entry.id"
                class="entry-row"
              >
                <div class="entry-identity">
                  <VChip
                    size="small"
                    label
                  >
                    {{ entry.kind }}
                  </VChip>
                  <strong>{{ entry.assetUrl }}</strong>
                  <span>{{ entry.assetUuid }}</span>
                </div>
                <VTextField
                  label="Address"
                  :model-value="entry.address"
                  hide-details
                  @change="updateEntryAddress(entry.id, $event)"
                />
                <VSelect
                  label="Labels"
                  :items="authoringData?.labels ?? []"
                  :model-value="entry.labels"
                  multiple
                  chips
                  closable-chips
                  hide-details
                  @update:model-value="updateEntryLabels(entry.id, $event)"
                />
                <VSelect
                  label="Move to group"
                  :items="groupItems"
                  :model-value="selectedGroup.id"
                  hide-details
                  @update:model-value="moveEntry(entry.id, $event)"
                />
                <VBtn
                  color="error"
                  variant="text"
                  @click="deleteEntry(entry.id)"
                >
                  Remove
                </VBtn>
              </div>

              <p
                v-if="selectedGroup.entries.length === 0"
                class="empty-entries"
              >
                This group has no explicit entries yet.
              </p>
            </VCardText>
          </template>
          <VCardText v-else>
            Create or select a group.
          </VCardText>
        </VCard>

        <div class="settings-pane">
          <VCard>
            <VCardTitle>Labels</VCardTitle>
            <VCardText>
              <div class="label-create-row">
                <VTextField
                  v-model="newLabel"
                  label="New label"
                  hide-details
                  @keydown.enter="createLabel"
                />
                <VBtn @click="createLabel">
                  Add
                </VBtn>
              </div>
              <div class="labels">
                <VChip
                  v-for="label in authoringData?.labels ?? []"
                  :key="label"
                  closable
                  @click:close="deleteLabel(label)"
                >
                  {{ label }}
                </VChip>
              </div>
            </VCardText>
          </VCard>

          <VCard>
            <VCardTitle>Diagnostics</VCardTitle>
            <VCardText class="diagnostics">
              <VAlert
                v-for="diagnostic in panelState.diagnostics"
                :key="`${diagnostic.code}:${diagnostic.groupId}:${diagnostic.entryId}`"
                :type="diagnostic.severity"
                density="compact"
              >
                {{ diagnostic.message }}
              </VAlert>
            </VCardText>
          </VCard>
        </div>
      </div>
    </VMain>
  </VApp>
</template>

<style lang="less">
:host,
#app {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>

<style scoped lang="less">
.asset-groups-app {
  min-width: 880px;
  min-height: 100%;
  background: rgb(var(--v-theme-background));
}

.busy-indicator {
  position: absolute;
  z-index: 20;
  inset: 0 0 auto;
}

.build-task-select {
  max-width: 320px;
  margin-inline-end: 12px;
}

.status-alert {
  margin: 12px;
}

.empty-state {
  display: grid;
  min-height: 480px;
  padding: 48px;
  place-content: center;
  justify-items: center;
  text-align: center;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(190px, 0.7fr) minmax(480px, 2fr) minmax(260px, 1fr);
  gap: 10px;
  padding: 10px;
  align-items: start;
}

.groups-pane,
.entries-pane,
.settings-pane {
  min-width: 0;
}

.settings-pane {
  display: grid;
  gap: 10px;
}

.group-create-row,
.group-order-actions,
.label-create-row,
.selected-group-title {
  display: flex;
  gap: 8px;
  align-items: center;
}

.group-order-actions {
  padding: 10px;
}

.asset-drop-zone {
  margin-block-end: 12px;
  padding: 24px;
  border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  color: rgb(var(--v-theme-on-surface-variant));
  text-align: center;

  &:hover {
    border-color: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-primary));
  }
}

.entry-row {
  display: grid;
  grid-template-columns: minmax(180px, 1.2fr) minmax(160px, 1fr) minmax(140px, 0.8fr) minmax(130px, 0.7fr) auto;
  gap: 8px;
  padding-block: 10px;
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  align-items: center;
}

.entry-identity {
  display: grid;
  gap: 3px;
  overflow: hidden;

  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    opacity: 0.65;
    font-size: 11px;
  }
}

.labels {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-block-start: 10px;
}

.diagnostics {
  display: grid;
  gap: 6px;
}

.empty-entries {
  padding: 24px;
  opacity: 0.65;
  text-align: center;
}
</style>
