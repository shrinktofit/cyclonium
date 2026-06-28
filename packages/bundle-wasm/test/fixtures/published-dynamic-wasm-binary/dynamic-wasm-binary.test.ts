import { describe, expect, it } from 'vitest';
import { loadWasmBinary } from 'published-wasm-binary-consumer';

describe('published dynamic wasm-binary import', () => {
  it('should import wasm binary bytes from a built dependency at runtime', async (): Promise<void> => {
    /// @case
    /// 1. A dependency package exports JavaScript from its built "lib" folder.
    /// 2. The dependency package dynamically imports "./fixture.wasm?wasm-binary".
    /// @expect
    /// The import resolves to the binary file contents as a Uint8Array without leaking internal virtual ids.
    const bytes = await loadWasmBinary();

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(bytes).trimEnd()).toBe('published bundle-wasm fixture bytes');
  });
});
