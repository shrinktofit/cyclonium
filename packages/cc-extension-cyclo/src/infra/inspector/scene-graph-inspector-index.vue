<script setup lang="ts">
const props = defineProps({
  inspectorData: {
    type: Object as PropType<{ dump: Dump | null }>,
    required: true,
  },
});

const submissionUiPropRef = useTemplateRef('submissionUiProp');
const dumpNotifier = new DumpNotifier(submissionUiPropRef as any);
provide(injectionKeyDumpNotifier, dumpNotifier);

function onDumpEvent(event: CustomEvent) {
  const dump = event.target.dump;
  console.debug(event.type, event, dump);
  event.stopImmediatePropagation();
  if (submissionUiPropRef.value) {
    submissionUiPropRef.value.submit(event.type, dump);
  }
}
</script>

<script lang="ts">
import { provide, useTemplateRef, type PropType } from 'vue';
import Component from './scene-graph/cyclo-scene-graph-inspector-app.vue';
import { wrapVueInspector } from './utils/vue-inspector-wrapper.js';
import CycloValueRouter from './basic/cyclo-value-router.vue';
import RawUiProp from './basic/raw/raw-ui-prop.vue';
import { DumpNotifier, injectionKeyDumpNotifier } from './basic/dump-notifier.js';
import type { Dump } from '../../dump/dump.js';

export const {
  template,
  $,
  ready,
  update,
  style,
} = wrapVueInspector(() => Component);
</script>

<template>
  <RawUiProp ref="submissionUiProp" />
  <div
    @change-dump="onDumpEvent"
    @confirm-dump="onDumpEvent"
  >
    <CycloValueRouter
      v-if="inspectorData.dump"
      :dump-path="''"
      :dump="inspectorData.dump"
    />
  </div>
</template>

<style lang="css" scoped>
.cyclo-inspector-app {
  width: 100%;
}
</style>
