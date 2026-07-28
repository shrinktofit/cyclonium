export function decodeUtf8(bytes: Uint8Array): string {
  const codePoints: number[] = [];
  let offset = (
    bytes.byteLength >= 3
    && bytes[0] === 0xEF
    && bytes[1] === 0xBB
    && bytes[2] === 0xBF
  )
    ? 3
    : 0;

  while (offset < bytes.byteLength) {
    const first = bytes[offset];
    offset += 1;

    if (first <= 0x7F) {
      codePoints.push(first);
      continue;
    }

    let additionalByteCount: number;
    let codePoint: number;
    let minimumCodePoint: number;
    if ((first & 0xE0) === 0xC0) {
      additionalByteCount = 1;
      codePoint = first & 0x1F;
      minimumCodePoint = 0x80;
    } else if ((first & 0xF0) === 0xE0) {
      additionalByteCount = 2;
      codePoint = first & 0x0F;
      minimumCodePoint = 0x800;
    } else if ((first & 0xF8) === 0xF0) {
      additionalByteCount = 3;
      codePoint = first & 0x07;
      minimumCodePoint = 0x10000;
    } else {
      throw new Error('The byte content contains invalid UTF-8.');
    }

    if (offset + additionalByteCount > bytes.byteLength) {
      throw new Error('The byte content ends inside a UTF-8 sequence.');
    }

    for (
      let continuationIndex = 0;
      continuationIndex < additionalByteCount;
      continuationIndex += 1
    ) {
      const continuation = bytes[offset];
      offset += 1;
      if ((continuation & 0xC0) !== 0x80) {
        throw new Error('The byte content contains invalid UTF-8.');
      }
      codePoint = (codePoint << 6) | (continuation & 0x3F);
    }

    if (
      codePoint < minimumCodePoint
      || codePoint > 0x10FFFF
      || (codePoint >= 0xD800 && codePoint <= 0xDFFF)
    ) {
      throw new Error('The byte content contains invalid UTF-8.');
    }

    codePoints.push(codePoint);
  }

  const segments: string[] = [];
  const segmentSize = 4096;
  for (
    let segmentStart = 0;
    segmentStart < codePoints.length;
    segmentStart += segmentSize
  ) {
    segments.push(String.fromCodePoint(
      ...codePoints.slice(segmentStart, segmentStart + segmentSize),
    ));
  }
  return segments.join('');
}
