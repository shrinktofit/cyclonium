import {
  ArtifactKind,
  type Artifact,
} from './model.js';

export interface ArtifactLease {
  retain(): ArtifactLease;
  release(): void;
}

export class ArtifactLeaseOwner {
  constructor(dispose: () => void | Promise<void>) {
    this.#dispose = dispose;
  }

  acquire(): ArtifactLease {
    if (this.#disposed) {
      throw new Error('A disposed Artifact lifetime cannot be retained.');
    }
    this.#leaseCount += 1;
    return new OwnedArtifactLease(this);
  }

  tryAcquire(): ArtifactLease | undefined {
    return this.#disposed ? undefined : this.acquire();
  }

  release(): void {
    if (this.#leaseCount <= 0) {
      throw new Error('Artifact lifetime lease accounting underflowed.');
    }
    this.#leaseCount -= 1;
    if (this.#leaseCount !== 0) {
      return;
    }

    this.#disposed = true;
    try {
      const result = this.#dispose();
      if (result instanceof Promise) {
        void result.catch(() => undefined);
      }
    } catch {
      // Artifact disposal is best-effort because public Handle release is sync.
    }
  }

  readonly #dispose: () => void | Promise<void>;
  #leaseCount = 0;
  #disposed = false;
}

export function permanentArtifactLease(): ArtifactLease {
  return PermanentArtifactLease;
}

export function retainArtifact(artifact: Artifact): Artifact {
  if (artifact.kind !== ArtifactKind.platformFile) {
    return artifact;
  }
  return {
    ...artifact,
    lease: artifact.lease.retain(),
  };
}

export function releaseArtifact(artifact: Artifact): void {
  if (artifact.kind === ArtifactKind.platformFile) {
    artifact.lease.release();
  }
}

class OwnedArtifactLease implements ArtifactLease {
  constructor(owner: ArtifactLeaseOwner) {
    this.#owner = owner;
  }

  retain(): ArtifactLease {
    if (this.#released) {
      throw new Error('A released Artifact lease cannot be retained.');
    }
    return this.#owner.acquire();
  }

  release(): void {
    if (this.#released) {
      return;
    }
    this.#released = true;
    this.#owner.release();
  }

  readonly #owner: ArtifactLeaseOwner;
  #released = false;
}

const PermanentArtifactLease: ArtifactLease = Object.freeze({
  retain: permanentArtifactLease,
  release: (): void => undefined,
});
