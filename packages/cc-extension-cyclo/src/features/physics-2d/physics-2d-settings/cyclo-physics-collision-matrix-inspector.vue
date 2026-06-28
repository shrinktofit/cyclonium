<script lang="ts" setup>
import { computed, ref, type PropType } from 'vue';
import type { BasicDump } from '../../../dump/dump.js';
import { useDumpNotifier } from '../../../infra/inspector/basic/dump-notifier.js';
import { concatDumpPath } from '../../../dump/dump-path.js';

const props = defineProps({
  dumpPath: {
    type: String,
    required: true,
  },

  dump: {
    type: Object as PropType<BasicDump<{
      values: BasicDump<boolean[]>;
    }>>,
    required: true,
  },

  tags: {
    type: Array as PropType<{
      tagName: string;
      tagIndex: number;
    }[]>,
    required: true,
  },
});

const dynamicStyle = computed(() => {
  const extent = props.tags.length + 1;
  return {
    gridTemplateColumns: `repeat(${extent}, fit-content(100%))`,
    gridTemplateRows: `repeat(${extent}, fit-content(100%))`,
  };
});

const matrixExtent = ref(16);

const dumpNotifier = useDumpNotifier();

function onMatrixElementChange(rowTagIndex: number, columnTagIndex: number, value: boolean) {
  console.debug('onMatrixElementChange', rowTagIndex, columnTagIndex);
  setMatrixElement(rowTagIndex, columnTagIndex, value);
  dumpNotifier.emitChange(props.dump.value.values, concatDumpPath(props.dumpPath, 'values'));
}

function getMatrixElement(rowTagIndex: number, columnTagIndex: number): boolean {
  const index = locateMatrixElement(rowTagIndex, columnTagIndex);
  return props.dump.value.values.value[index];
}

function setMatrixElement(rowTagIndex: number, columnTagIndex: number, value: boolean) {
  const index = locateMatrixElement(rowTagIndex, columnTagIndex);
  props.dump.value.values.value[index] = value;
}

function locateMatrixElement(i: number, j: number) {
  if (i < 0 || i >= matrixExtent.value || j < 0 || j >= matrixExtent.value) {
    throw new Error(`Index out of range.`);
  }
  if (i > j) {
    [i, j] = [j, i];
  }
  const rowStart = i * (2 * matrixExtent.value - i - 1) / 2;
  return rowStart + j;
}

const tagsByRow = computed(() => {
  return props.tags.slice().sort((a, b) => (a.tagIndex - b.tagIndex));
});

const tagsByColumn = computed(() => {
  return props.tags.slice().sort((a, b) => (b.tagIndex - a.tagIndex));
});

function unsetMatrixElementByTag(tagName: string) {
  const tag = props.tags.find((tag) => tag.tagName === tagName);
  if (!tag) {
    return;
  }
  for (let i = 0; i < props.tags.length; i++) {
    const rowTag = props.tags[i];
    setMatrixElement(rowTag.tagIndex, tag.tagIndex, false);
    setMatrixElement(tag.tagIndex, rowTag.tagIndex, false);
  }
  dumpNotifier.emitChange(props.dump.value.values, concatDumpPath(props.dumpPath, 'values'));
}

defineExpose({
  unsetMatrixElementByTag,
});
</script>

<template>
  <div
    class="cyclo-physics-collision-matrix-inspector"
    :style="dynamicStyle"
  >
    <!-- Column heads -->
    <span />
    <template
      v-for="(rowTag, iRowTag) in tagsByColumn"
      :key="iRowTag"
    >
      <ui-label
        class="column-header"
        :tooltip="`Index: ${rowTag.tagIndex}`"
      >
        {{ rowTag.tagName }}
      </ui-label>
    </template>

    <template
      v-for="(rowTag) in tagsByRow"
      :key="rowTag.tagIndex"
    >
      <ui-label :tooltip="`Index: ${rowTag.tagIndex}`">
        {{ rowTag.tagName }}
      </ui-label>
      <template
        v-for="(columnTag) in tagsByColumn"
        :key="columnTag.tagIndex"
      >
        <ui-checkbox
          v-if="rowTag.tagIndex <= columnTag.tagIndex"
          :value="getMatrixElement(rowTag.tagIndex, columnTag.tagIndex)"
          :tooltip="`${locateMatrixElement(rowTag.tagIndex, columnTag.tagIndex)}: ${rowTag.tagName}(${rowTag.tagIndex}) | ${columnTag.tagName}(${columnTag.tagIndex})`"
          @change="onMatrixElementChange(rowTag.tagIndex, columnTag.tagIndex, $event.target.value)"
        />
        <span v-else />
      </template>
    </template>
  </div>
</template>

<style lang="css" scoped>
.cyclo-physics-collision-matrix-inspector {
  display: grid;
  gap: 0.5em;
}

.column-header {
  writing-mode: tb-rl;
}
</style>
