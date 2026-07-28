import type {
  ByteArtifact,
  ArtifactLocation,
} from './model.js';

interface ByteArtifactCacheEntry {
  readonly artifact: ByteArtifact;
  readonly byteSize: number;
}

export function encodeArtifactHashCacheKey(
  location: ArtifactLocation,
): string | undefined {
  if (location.hash === undefined) {
    return undefined;
  }

  return JSON.stringify([
    'hash',
    location.hash.toLowerCase(),
    location.preferredKind ?? '',
  ]);
}

export function encodeArtifactLocationCacheKey(
  location: ArtifactLocation,
): string {
  return JSON.stringify([
    'location',
    location.sourceId,
    location.key,
    location.revision ?? '',
    location.preferredKind ?? '',
  ]);
}

export class ByteArtifactCache {
  constructor(byteBudget: number) {
    if (!Number.isSafeInteger(byteBudget) || byteBudget < 0) {
      throw new RangeError(
        'The artifact cache byte budget must be a non-negative safe integer.',
      );
    }

    this.#byteBudget = byteBudget;
  }

  get byteBudget(): number {
    return this.#byteBudget;
  }

  get byteSize(): number {
    return this.#byteSize;
  }

  get size(): number {
    return this.#entries.size;
  }

  get(key: string): ByteArtifact | undefined {
    const entry = this.#entries.get(key);
    if (entry === undefined) {
      return undefined;
    }

    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.artifact;
  }

  set(key: string, artifact: ByteArtifact): void {
    const existing = this.#entries.get(key);
    if (existing !== undefined) {
      this.#entries.delete(key);
      this.#byteSize -= existing.byteSize;
    }

    const byteSize = artifact.bytes.byteLength;
    if (this.#byteBudget === 0 || byteSize > this.#byteBudget) {
      return;
    }

    this.#entries.set(key, {
      artifact,
      byteSize,
    });
    this.#byteSize += byteSize;
    this.#evictToBudget();
  }

  delete(key: string): boolean {
    const entry = this.#entries.get(key);
    if (entry === undefined) {
      return false;
    }

    this.#entries.delete(key);
    this.#byteSize -= entry.byteSize;
    return true;
  }

  clear(): void {
    this.#entries.clear();
    this.#byteSize = 0;
  }

  readonly #entries = new Map<string, ByteArtifactCacheEntry>();
  readonly #byteBudget: number;
  #byteSize = 0;

  #evictToBudget(): void {
    while (this.#byteSize > this.#byteBudget) {
      const oldest = this.#entries.entries().next();
      if (oldest.done) {
        throw new Error(
          'Artifact cache accounting is inconsistent with its entries.',
        );
      }

      const [key, entry] = oldest.value;
      this.#entries.delete(key);
      this.#byteSize -= entry.byteSize;
    }
  }
}
