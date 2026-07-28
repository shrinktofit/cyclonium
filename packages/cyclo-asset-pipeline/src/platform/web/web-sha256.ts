export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    throw new Error('Web Crypto SHA-256 is unavailable.');
  }

  const digest = await subtle.digest('SHA-256', bytes.slice());
  return new Uint8Array(digest);
}
