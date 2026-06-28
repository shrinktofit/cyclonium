<script setup lang="ts">
import { type PropType } from 'vue';
import { getInspectorComponent } from './inspector-registry.js';
import type { Dump } from '../../../dump/dump.js';

const props = defineProps({
  dumpPath: {
    type: String,
    required: true,
  },

  dump: {
    type: Object as PropType<Dump>,
    required: true,
  },
});

</script>

<template>
  <component
    :is="getInspectorComponent(dump)"
    :dump-path="props.dumpPath"
    :dump="dump"
  />
</template>
