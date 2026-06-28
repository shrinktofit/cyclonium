import { describe, expect, it } from 'vitest';
import { resolveBuiltinPipelineURL } from '@/editor-preview-based/import-map.js';

describe('resolveBuiltinPipelineURL', () => {
  it('should locate the builtin pipeline URL by its stable import-map source key', () => {
    const defaultRenderPipelineDir = 'file:///preview-engine/editor/assets/default_renderpipeline';
    const builtinPipelineSpecifier = `${defaultRenderPipelineDir}/builtin-pipeline.ts`;
    const importMapURL = new URL('http://localhost:7456/scripting/x/import-map.json');

    expect(resolveBuiltinPipelineURL({
      imports: {
        [`${defaultRenderPipelineDir}/builtin-pipeline-pass.ts`]: './chunks/c1/pass.js',
        [builtinPipelineSpecifier]: './chunks/c1/c13be63ea4603203e523072954d7e785dacda0fc.js',
        cc: './chunks/cc.js',
      },
    }, importMapURL)).toBe('http://localhost:7456/scripting/x/chunks/c1/c13be63ea4603203e523072954d7e785dacda0fc.js');
  });

  it('should throw a clear error when the builtin pipeline key is missing', () => {
    expect(() => {
      resolveBuiltinPipelineURL({
        imports: {
          cc: './chunks/cc.js',
        },
      }, new URL('http://localhost:7456/scripting/x/import-map.json'));
    }).toThrow('Can not locate builtin pipeline module in editor preview import map.');
  });
});
