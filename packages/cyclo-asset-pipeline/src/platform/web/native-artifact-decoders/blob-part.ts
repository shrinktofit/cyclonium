export function blobPartFromBytes(
  bytes: Uint8Array,
): Uint8Array<ArrayBuffer> {
  const buffer = bytes.buffer;
  return buffer instanceof ArrayBuffer
    ? new Uint8Array(buffer, bytes.byteOffset, bytes.byteLength)
    : bytes.slice();
}
