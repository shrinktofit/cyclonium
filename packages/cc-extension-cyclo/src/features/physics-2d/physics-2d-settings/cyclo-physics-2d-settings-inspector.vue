<script setup lang="ts">
import { computed, ref, useTemplateRef, type PropType } from 'vue';
import CycloObjectInspector from '../../../infra/inspector/basic/cyclo-object-inspector.vue';
import { useDumpNotifier } from '../../../infra/inspector/basic/dump-notifier.js';
import type { BasicDump, Dump } from '../../../dump/dump.js';
import RawUiInput from '../../../infra/inspector/basic/raw/raw-ui-input.vue';
import CycloPhysicsCollisionMatrixInspector from './cyclo-physics-collision-matrix-inspector.vue';
import { concatDumpPath } from '../../../dump/dump-path.js';

const props = defineProps({
  dumpPath: {
    type: String,
    required: true,
  },

  dump: {
    type: Object as PropType<BasicDump<{
      tags_editor: BasicDump<Record<string, number>>;
      collisionMatrix: Dump;
    }>>,
    required: true,
  },
});

const tags = ref({ ...props.dump.value.tags_editor.value });

const dumpNotifier = useDumpNotifier();

const matrixTags = computed(() => {
  return Object.entries(tags.value).map(([tagName, tagIndex]) => ({ tagName, tagIndex }));
});

const matrix = useTemplateRef('matrix');

function onTagChange(index: number, value: string) {
  const existing = Object.entries(tags.value).find(([_, tagIndex]) => tagIndex === index)?.[0];
  if (existing) {
    delete tags.value[existing];
  }
  if (value) {
    tags.value[value] = index;
  } else if (existing) {
    if (matrix.value) {
      matrix.value.unsetMatrixElementByTag(existing);
    }
  }
  props.dump.value.tags_editor.value = tags.value;
  dumpNotifier.emitChange(props.dump.value.tags_editor, 'tags_editor');
}
</script>

<template>
  <CycloObjectInspector
    :dump-path="props.dumpPath"
    :dump="props.dump"
  >
    <template #prop-value-slot-tags_editor>
      <div class="tags">
        <template
          v-for="(tag, index) in Array.from({length: 16})"
          :key="index"
        >
          <span>{{ index }}</span>
          <RawUiInput
            ui-slot="content"
            :value="matrixTags.find(({tagIndex}) => tagIndex === index)?.tagName ?? ''"
            @confirm="onTagChange(index, $event)"
          />
        </template>
      </div>
    </template>

    <template #prop-value-slot-collisionMatrix>
      <CycloPhysicsCollisionMatrixInspector
        ref="matrix"
        :dump-path="concatDumpPath(props.dumpPath, 'collisionMatrix')"
        :dump="props.dump.value.collisionMatrix"
        :tags="matrixTags"
      />
    </template>
  </CycloObjectInspector>
</template>

<style lang="css" scoped>
.tags {
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: 1em;
  justify-items: left;
}
</style>
