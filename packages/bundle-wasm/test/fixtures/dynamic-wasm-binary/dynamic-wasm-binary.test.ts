import { describe, expect, it } from 'vitest';
import { loadWasmBinary } from 'wasm-binary-consumer';

describe('dynamic wasm-binary import', () => {
  it('should import wasm binary bytes at runtime', async (): Promise<void> => {
    /// @case
    /// 1. A dependency package dynamically imports "./fixture.wasm?wasm-binary".
    /// 2. The bundleWasm Vite plugin is configured with test mode enabled.
    /// @expect
    /// The import resolves to the binary file contents as a Uint8Array.
    const bytes = await loadWasmBinary();

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(bytes).trimEnd()).toBe('bundle-wasm fixture bytes');
  });
});
