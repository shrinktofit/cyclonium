<script setup lang="ts">
const props = defineProps({
  inspectorData: {
    type: Object as PropType<{ dump: Dump | null }>,
    required: true,
  },
});
</script>

<script lang="ts">
import { type PropType } from 'vue';
import CycloAssetInspectorApp from './asset/cyclo-asset-inspector-app.vue';
import type { Dump } from '../../dump/dump.js';
import { wrapVueAssetInspector } from './utils/vue-asset-inspector-wrapper.js';

export const {
  template,
  $,
  ready,
  update,
  style,
} = wrapVueAssetInspector(() => CycloAssetInspectorApp);
</script>

<template>
  <div>
    hello world!
  </div>
</template>

<style lang="css" scoped>
.cyclo-inspector-app {
  width: 100%;
}
</style>
