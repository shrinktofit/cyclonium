<script lang="ts" setup>
/* eslint-disable vue/no-deprecated-slot-attribute */
import type { PropType } from 'vue';
import CycloValueRouter from './cyclo-value-router.vue';
import type { Dump } from '../../../dump/dump.js';
import { concatDumpPath } from '../../../dump/dump-path.js';

const props = defineProps({
  dumpPath: {
    type: String,
    required: true,
  },

  dump: {
    type: Object as PropType<Dump>,
    required: true,
  },

  inlined: {
    type: Boolean,
    default: false,
  },
});
</script>

<template>
  <div :class="inlined ? 'cyclo-object-inspector-inlined' : 'cyclo-object-inspector'">
    <template
      v-for="([k, v]) in Object.entries(props.dump.value)"
      :key="k"
    >
      <template v-if="v.visible">
        <slot :name="`prop-slot-${k}`">
          <ui-prop>
            <ui-label
              slot="label"
              :value="k"
            />
            <ui-prop slot="content">
              <slot :name="`prop-value-slot-${k}`">
                <CycloValueRouter
                  :dump-path="concatDumpPath(props.dumpPath, k)"
                  :dump="v"
                />
              </slot>
            </ui-prop>
          </ui-prop>
        </slot>
      </template>
    </template>
  </div>
</template>

<style lang="css" scoped>
.cyclo-object-inspector {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
}

.cyclo-object-inspector-inlined {
  display: flex;
  flex-direction: row;
  gap: 0.5em;
  place-items: center;
}
</style>
