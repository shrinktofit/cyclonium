import { Bounds2D } from '@cyclonium/math/bounds-2d';
import { applyLegacyDecorators, stored, editable } from '../export/legacy-decorator.ts';
import { cycloBuiltinClass } from '../decorator/legacy/legacy-decorator.ts';

export * from '@cyclonium/math/bounds-2d';

applyLegacyDecorators(Bounds2D, {
  classDecorators: [cycloBuiltinClass('Bounds2D')],
  propertyDecorators: {
    // @ts-expect-error -- Legacy decorators intentionally target Bounds2D's private serialized fields.
    _min: [stored, editable],
    _max: [stored, editable],
  },
});
