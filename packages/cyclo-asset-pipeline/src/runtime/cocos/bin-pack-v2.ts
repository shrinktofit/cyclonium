const BIN_PACK_MAGIC = 'BINP';
const BIN_PACK_VERSION = 2;
const UINT32_BYTE_LENGTH = 4;
const BIN_PACK_FIXED_HEADER_UINT32_COUNT = 3;
const BIN_PACK_ENTRY_UINT32_COUNT = 2;

export function readBinPackV2Entry(
  bytes: Uint8Array,
  entryIndex: number,
): Uint8Array {
  if (!Number.isSafeInteger(entryIndex) || entryIndex < 0) {
    throw new Error(
      `A BINP-v2 entry index must be a non-negative safe integer; received ${entryIndex}.`,
    );
  }

  const fixedHeaderByteLength
    = BIN_PACK_FIXED_HEADER_UINT32_COUNT * UINT32_BYTE_LENGTH;
  if (bytes.byteLength < fixedHeaderByteLength) {
    throw new Error('The BINP-v2 artifact is shorter than its fixed header.');
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );
  const magic = String.fromCharCode(
    bytes[0],
    bytes[1],
    bytes[2],
    bytes[3],
  );
  if (magic !== BIN_PACK_MAGIC) {
    throw new Error(
      `Invalid BINP-v2 magic "${magic}"; expected "${BIN_PACK_MAGIC}".`,
    );
  }

  const version = view.getUint32(UINT32_BYTE_LENGTH, true);
  if (version !== BIN_PACK_VERSION) {
    throw new Error(
      `Unsupported BINP version ${version}; only version ${BIN_PACK_VERSION} is supported.`,
    );
  }

  const entryCount = view.getUint32(UINT32_BYTE_LENGTH * 2, true);
  if (entryIndex >= entryCount) {
    throw new Error(
      `BINP-v2 entry ${entryIndex} is outside the package entry count ${entryCount}.`,
    );
  }

  const tableUint32Count
    = BIN_PACK_FIXED_HEADER_UINT32_COUNT
      + entryCount * BIN_PACK_ENTRY_UINT32_COUNT;
  const tableByteLength = tableUint32Count * UINT32_BYTE_LENGTH;
  if (tableByteLength > bytes.byteLength) {
    throw new Error('The BINP-v2 entry table extends beyond the artifact.');
  }

  const entryTableOffset = UINT32_BYTE_LENGTH
    * (
      BIN_PACK_FIXED_HEADER_UINT32_COUNT
      + entryIndex * BIN_PACK_ENTRY_UINT32_COUNT
    );
  const relativeOffset = view.getUint32(entryTableOffset, true);
  const entryByteLength = view.getUint32(
    entryTableOffset + UINT32_BYTE_LENGTH,
    true,
  );
  const entryOffset = tableByteLength + relativeOffset;
  const entryEnd = entryOffset + entryByteLength;

  if (
    entryOffset < tableByteLength
    || entryEnd < entryOffset
    || entryEnd > bytes.byteLength
  ) {
    throw new Error(
      `BINP-v2 entry ${entryIndex} points outside the artifact.`,
    );
  }

  return bytes.subarray(entryOffset, entryEnd);
}
