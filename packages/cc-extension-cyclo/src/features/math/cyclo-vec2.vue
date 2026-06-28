<script setup lang="ts">
import type { PropType } from 'vue';
import CycloObjectInspector from '../../infra/inspector/basic/cyclo-object-inspector.vue';
import { useDumpNotifier } from '../../infra/inspector/basic/dump-notifier.js';
import RawUiNumInput from '../../infra/inspector/basic/raw/raw-ui-num-input.vue';
import type { Dump } from '../../dump/dump.js';

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

const dumpNotifier = useDumpNotifier();

function onChange(key: 'x' | 'y', value: number) {
  const componentDump = props.dump.value[key];
  dumpNotifier.emitChange({
    ...componentDump,
    value: value as any,
  }, props.dumpPath);
}
</script>

<template>
  <CycloObjectInspector
    :dump-path="props.dumpPath"
    :dump="props.dump"
    inlined
  >
    <template #prop-slot-x>
      <RawUiNumInput
        ui-slot="content"
        label="X"
        v-bind="props.dump.value.x"
        @change="onChange('x', $event)"
      />
    </template>
    <template #prop-slot-y>
      <RawUiNumInput
        ui-slot="content"
        label="Y"
        v-bind="props.dump.value.y"
        @change="onChange('y', $event)"
      />
    </template>
  </CycloObjectInspector>
</template>

<style lang="css" scoped>
.cyclo-vec2-inspector {
  display: flex;
  flex-direction: row;
}
</style>
