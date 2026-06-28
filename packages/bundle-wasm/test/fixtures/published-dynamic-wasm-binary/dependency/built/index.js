export async function loadWasmBinary() {
  const { default: bytes } = await import('./fixture.wasm?wasm-binary');
  return bytes;
}
