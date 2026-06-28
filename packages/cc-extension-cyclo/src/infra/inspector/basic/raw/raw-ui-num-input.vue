<script setup lang="ts">
import { computed, type PropType } from 'vue';

const props = defineProps({
  uiSlot: {
    type: String,
    required: true,
  },
  value: {
    type: Number,
    default: undefined,
  },
  label: {
    type: String,
    default: undefined,
  },
  type: {
    type: String,
    default: undefined,
  },
  slide: {
    type: Boolean,
    default: undefined,
  },
  unit: {
    type: String,
    default: undefined,
  },
  min: {
    type: Number,
    default: undefined,
  },
  max: {
    type: Number,
    default: undefined,
  },
  step: {
    type: Number,
    default: undefined,
  },
  default: {
    type: Number,
    default: undefined,
  },
  values: {
    type: Array as PropType<number[]>,
    default: undefined,
  },
  radian: {
    type: Boolean,
    default: undefined,
  },
});

const forwardProps = computed(() => {
  const {
    uiSlot,
    ...passthrough
  } = props;
  return {
    slot: uiSlot,
    ...passthrough,
  };
});

const emit = defineEmits<{
  change: [value: number];
}>();

function onChange(event: CustomEvent) {
  const target = event.target as unknown as {
    value: number;
  } & HTMLElement;
  const value = target.value;
  if (value !== props.value) {
    emit('change', target.value);
  }
}
</script>

<template>
  <ui-num-input
    ref="raw-element"
    v-bind="forwardProps"
    @change.stop="onChange"
  />
</template>
