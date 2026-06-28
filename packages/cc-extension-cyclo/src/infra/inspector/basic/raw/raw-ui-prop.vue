<script setup lang="ts">
import { onMounted, ref, toRaw, useTemplateRef, watch, type PropType } from 'vue';
import { toRawDeep } from '../../utils/vue-to-raw-deep.js';
import type { BasicDump, Dump } from '../../../../dump/dump.js';

const props = defineProps({
  dump: {
    type: Object as PropType<Dump | null>,
    default: null,
  },
});

const dumpStash = ref<null | Dump>(null);

const rawElementRef = useTemplateRef<HTMLElement & {
  render: (dump: Dump) => void;
  dump: BasicDump | undefined;
  dumpPath: string | undefined;
  dispatch(eventType: 'change-dump' | 'confirm-dump'): void;
}>('raw-element');

onMounted(() => {
  const dumpValue = toRaw(dumpStash.value);
  if (rawElementRef.value && dumpValue) {
    rawElementRef.value.render(dumpValue);
  }
});

watch(() => props.dump, () => {
  if (rawElementRef.value) {
    if (props.dump) {
      const dumpValue = toRaw(props.dump);
      rawElementRef.value.render(dumpValue);
    }
  } else {
    dumpStash.value = props.dump;
  }
}, { immediate: true });

function submit<T>(type: 'change-dump' | 'confirm-dump', dump: BasicDump<T>, dumpPath: string) {
  if (rawElementRef.value) {
    const rawDump = toRawDeep(dump);
    rawElementRef.value.dump = rawDump;
    rawElementRef.value.dumpPath = dumpPath;
    rawElementRef.value.dispatch(type);
  }
}

defineExpose({
  submit,
});
</script>

<template>
  <ui-prop
    ref="raw-element"
    type="dump"
    no-label
  />
</template>
