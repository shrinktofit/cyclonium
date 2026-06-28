<script lang="ts" setup>
import { InputNumber } from 'primevue';
import type { PropType } from 'vue';
import type { CycloNumberDump } from '../../../dump/number.js';

const props = defineProps({
  dump: {
    type: Object as PropType<CycloNumberDump>,
    required: true,
  },
});
</script>

<template>
  <InputNumber
    v-model:value="dump.value"
    :readonly="dump.readonly"
    :min="dump.min"
    :max="dump.max"
  />
</template>
