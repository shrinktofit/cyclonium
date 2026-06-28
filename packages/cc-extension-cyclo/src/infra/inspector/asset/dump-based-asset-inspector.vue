<script setup lang="ts">
import { provide, ref, useTemplateRef, watch, type PropType } from 'vue';
import type { AssetInspectorData } from './data.js';
import type { Dump } from '../../../dump/dump.js';
import { invokeSelfSceneMethod } from '../../scene/invoke-scene-method.js';
import { DumpNotifier, injectionKeyDumpNotifier } from '../basic/dump-notifier.js';
import RawUiProp from '../basic/raw/raw-ui-prop.vue';
import CycloValueRouter from '../basic/cyclo-value-router.vue';
import { logger } from '../../../logger.js';

const props = defineProps({
  inspectorData: {
    type: Object as PropType<AssetInspectorData>,
    required: true,
  },
});

const dump = ref<Dump | null>(null);

watch(
  () => props.inspectorData.asset.uuid,
  async (uuid) => {
    if (!uuid) {
      return;
    }
    const dumpData = await invokeSelfSceneMethod('dump-asset', uuid);
    dump.value = dumpData;
  },
  { immediate: true },
);

const submissionUiPropRef = useTemplateRef('submissionUiProp');
const dumpNotifier = new DumpNotifier(submissionUiPropRef as any);
provide(injectionKeyDumpNotifier, dumpNotifier);

function onDumpEvent(event: CustomEvent) {
  if (!event.target) {
    logger.warn(`Received dump event from null event target`);
    return;
  }
  const dump = event.target.dump;
  const dumpPath = event.target.dumpPath;
  console.debug(event.type, event, dump, dumpPath);
  event.stopImmediatePropagation();
  if (!dump) {
    return;
  }
  (async () => {
    await invokeSelfSceneMethod('apply-dump', props.inspectorData.asset.uuid, dump, dumpPath);
  })().catch((error) => {
    logger.error('apply-dump failed', error);
  });
}

async function onCommit() {
  await invokeSelfSceneMethod('save-asset', props.inspectorData.asset.uuid);
}
</script>

<template>
  <div v-if="!dump">
    <span>Asset not loaded</span>
  </div>
  <div
    v-else
    class="dump-based-asset-inspector"
    @change-dump="onDumpEvent"
    @confirm-dump="onDumpEvent"
  >
    <div>
      <ui-button @confirm="onCommit">
        <ui-icon value="check" />
      </ui-button>
    </div>

    <RawUiProp ref="submissionUiProp" />
    <div>
      <CycloValueRouter
        v-if="dump"
        :dump-path="''"
        :dump="dump"
      />
    </div>
  </div>
</template>

<style lang="css" scoped>
.dump-based-asset-inspector {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.buttons {
  display: flex;
  flex-direction: row;
  place-items: flex-end;
}
</style>
