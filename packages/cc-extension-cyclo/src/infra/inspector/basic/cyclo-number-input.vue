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

const emit = defineEmits<{
  change: [value: number | null];
}>();
</script>

<template>
  <InputNumber
    :value="props.dump.value"
    :readonly="dump.readonly"
    :min="dump.min"
    :max="dump.max"
    @update:value="emit('change', $event)"
  />
</template>
