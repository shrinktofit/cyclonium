<script setup lang="ts">
import type { PropType } from 'vue';
import type { AssetInspectorData } from './data.js';

const props = defineProps({
  inspectorData: {
    type: Object as PropType<AssetInspectorData>,
    required: true,
  },
});
</script>

<template>
  <div class="default-asset-inspector">
    <span>
      {{
        JSON.stringify(props.inspectorData.meta.userData, undefined, 2)
      }}
    </span>
  </div>
</template>

<style lang="css" scoped>
.default-asset-inspector {
  width: 100%;
  display: flex;
  flex-direction: column;
}
</style>
