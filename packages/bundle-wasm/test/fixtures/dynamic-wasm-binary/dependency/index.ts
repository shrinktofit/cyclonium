export async function loadWasmBinary(): Promise<Uint8Array> {
  const { default: bytes } = await import('./fixture.wasm?wasm-binary');
  return bytes;
}
