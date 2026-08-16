import { Vec2, v2 } from '@cyclonium/math/vec2';
import { applyLegacyDecorators } from '../decorator/legacy/apply-legacy-decorators.ts';
import { editable, cycloBuiltinClass, stored } from '../decorator/legacy/legacy-general-decorator.ts';
import * as cc from 'cc';

applyLegacyDecorators(Vec2, {
  classDecorators: [cycloBuiltinClass('Vec2')],
  // @ts-expect-error -- Legacy decorators require metadata for Vec2 fields declared by another package.
  propertyDecorators: {
    x: [stored, editable],
    y: [stored, editable],
  },
});

export { Vec2, v2 };

export function _toCCVec2(v: Vec2) {
  return cc.v2(v.x, v.y);
}
