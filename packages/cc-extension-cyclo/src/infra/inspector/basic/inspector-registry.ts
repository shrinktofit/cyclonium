import type { Component } from 'vue';
import CycloVec2 from '../../../features/math/cyclo-vec2.vue';
import CycloPhysics2DSettings from '../../../features/physics-2d/physics-2d-settings/cyclo-physics-2d-settings-inspector.vue';
import RawUiProp from './raw/raw-ui-prop.vue';
import CycloObjectInspector from './cyclo-object-inspector.vue';
import type { Dump } from '../../../dump/dump.js';

const componentByValueTypeRegistry = new Map<string, Component<{ dump: any }>>();

function registerInspectorComponentByValueType(valueType: string, component: Component<{ dump: any }>) {
  componentByValueTypeRegistry.set(valueType, component);
}

export function getInspectorComponent(dump: Dump) {
  if (dump.type) {
    const byType = componentByValueTypeRegistry.get(dump.type);
    if (byType) {
      return byType;
    }
  }
  if (typeof dump.value === 'object' && dump.value) {
    return CycloObjectInspector;
  }
  return RawUiProp;
}

registerInspectorComponentByValueType('cyclo.Vec2', CycloVec2);
registerInspectorComponentByValueType('cyclo.Physics2DSettings', CycloPhysics2DSettings);
