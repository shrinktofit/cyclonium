<script setup lang="ts">
import type { PropType } from 'vue';
import type { AssetInspectorData } from '../asset/data.js';
import { getAssetInspectorComponent } from './asset-inspector-registry.js';

const props = defineProps({
  inspectorData: {
    type: Object as PropType<{ data: null | AssetInspectorData }>,
    default: () => ({ data: null }),
  },
});
</script>

<template>
  <div v-if="!props.inspectorData.data">
    <span>Asset not loaded</span>
  </div>
  <div v-else>
    <span>{{ props.inspectorData.data.asset.name }}</span>
    <component
      :is="getAssetInspectorComponent(props.inspectorData.data)"
      v-if="props.inspectorData.data"
      :inspector-data="props.inspectorData.data"
    />
  </div>
</template>

<style lang="css" scoped>
.cyclo-inspector-app {
  width: 100%;
  display: flex;
  flex-direction: column;
}
</style>
