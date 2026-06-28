import { join } from 'node:path';
import { type Plugin } from 'vite';

export default function useEditorModules(): Plugin {
  return {
    name: 'cyclo:use-editor-module',

    resolveId(id) {
      if (id.startsWith('@editor/') || id === 'cc' || id.startsWith('cc/editor/')) {
        return id;
      }
    },

    load(id) {
      if (id.startsWith('@editor/') || id === 'cc' || id.startsWith('cc/editor/')) {
        const m = join(import.meta.dirname, '../require-editor-module.js').replace(/\\/g, '/');
        return {
          syntheticNamedExports: true,
          code: `import {requireEditorModule} from '${m}'; export default requireEditorModule('${id}');`,
        };
      }
    },
  };
}
