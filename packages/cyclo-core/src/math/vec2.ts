import { Vec2, v2 } from '@cyclonium/math/vec2';
import { applyLegacyDecorators } from '../decorator/legacy/apply-legacy-decorators.ts';
import { editable, cycloBuiltinClass, serializable } from '../decorator/legacy/legacy-general-decorator.ts';
import * as cc from 'cc';

applyLegacyDecorators(Vec2, {
  classDecorators: [cycloBuiltinClass('Vec2')],
  // @ts-expect-error
  propertyDecorators: {
    x: [serializable, editable],
    y: [serializable, editable],
  },
});

export { Vec2, v2 };

export function _toCCVec2(v: Vec2) {
  return cc.v2(v.x, v.y);
}
