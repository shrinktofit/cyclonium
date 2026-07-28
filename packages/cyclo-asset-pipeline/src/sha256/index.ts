import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js';

export function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return Promise.resolve().then(() => nobleSha256(bytes));
}
