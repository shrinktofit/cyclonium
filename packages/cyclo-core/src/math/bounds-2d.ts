import { Bounds2D } from '@cyclonium/math/bounds-2d';
import { applyLegacyDecorators, serializable, editable } from '../export/legacy-decorator.ts';
import { cycloBuiltinClass } from '../decorator/legacy/legacy-decorator.ts';

export * from '@cyclonium/math/bounds-2d';

applyLegacyDecorators(Bounds2D, {
  classDecorators: [cycloBuiltinClass('Bounds2D')],
  propertyDecorators: {
    // @ts-expect-error
    _min: [serializable, editable],
    _max: [serializable, editable],
  },
});
