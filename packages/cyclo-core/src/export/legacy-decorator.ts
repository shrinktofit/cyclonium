export {
  designType,
  editable,
  editorOnly,
  cycloClass,
  createScopedCycloClassDecorator,
  dynamicDefault,
  idem,
  idemBy,
  stored,
  type CycloClassOptions,
  type CycloClassDecorator,
} from '../decorator/legacy/legacy-general-decorator.ts';

export {
  disallowMultiple,
  executionOrder,
  executeInEditMode,
  requiresComponent,
} from '../decorator/legacy/legacy-component-decorator.ts';

export { applyLegacyDecorators } from '../decorator/legacy/apply-legacy-decorators.ts';
