<script setup lang="ts">
import { computed, ref, type PropType } from 'vue';

const props = defineProps({
  uiSlot: {
    type: String,
    default: undefined,
  },
  value: {
    type: String,
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
  change: [value: string];
  confirm: [value: string];
}>();

const cachedChangedValue = ref(props.value);

function onChange(event: CustomEvent) {
  const target = event.target as unknown as {
    value: string;
  } & HTMLElement;
  const value = target.value;
  if (value !== cachedChangedValue.value) {
    cachedChangedValue.value = value;
    emit('change', value);
  }
}

const cachedConfirmedValue = ref(props.value);

function onConfirm(event: CustomEvent) {
  const target = event.target as unknown as {
    value: string;
  } & HTMLElement;
  const value = target.value;
  if (value !== cachedConfirmedValue.value) {
    cachedConfirmedValue.value = value;
    emit('confirm', value);
  }
}
</script>

<template>
  <ui-input
    ref="raw-element"
    v-bind="forwardProps"
    @change.stop="onChange"
    @confirm.stop="onConfirm"
  />
</template>
