import {
  AbortController,
  type AbortSignal,
} from '@cyclonium/abort-controller';

import {
  ArtifactLeaseOwner,
  permanentArtifactLease,
  type ArtifactLease,
} from '../../core/artifact-lifetime.js';
import type { ArtifactSource } from '../../core/contracts.js';
import {
  ArtifactKind,
  type Artifact,
  type ArtifactAcquisitionProgress,
  type ArtifactLocation,
} from '../../core/model.js';
import {
  createMinigameAbortError,
  type MinigameDownloadedFile,
  type MinigamePlatformAdapter,
} from './minigame-platform-adapter.js';

export class MinigameArtifactSource implements ArtifactSource {
  constructor(
    platform: MinigamePlatformAdapter,
    id = `minigame-${platform.id}`,
  ) {
    this.#platform = platform;
    this.id = id;
  }

  readonly id: string;

  async acquire(
    location: ArtifactLocation,
    signal: AbortSignal,
    reportProgress?: (progress: ArtifactAcquisitionProgress) => void,
  ): Promise<Artifact> {
    const format = normalizeFormat(location.format);
    if (location.preferredKind === ArtifactKind.platformFile) {
      if (isHttpUrl(location.key)) {
        const file = await this.#acquireDownloadedFile(location.key, signal);
        return {
          kind: ArtifactKind.platformFile,
          path: file.file.path,
          lease: file.lease,
          format,
          sourceId: this.id,
          contentType: file.file.contentType,
        };
      }

      return {
        kind: ArtifactKind.platformFile,
        path: location.key,
        lease: permanentArtifactLease(),
        format,
        sourceId: this.id,
      };
    }

    if (isHttpUrl(location.key)) {
      const response = await this.#platform.requestBytes(location.key, signal);
      reportProgress?.({
        loadedBytes: response.bytes.byteLength,
      });
      return {
        kind: ArtifactKind.bytes,
        bytes: response.bytes,
        format,
        sourceId: this.id,
        contentType: response.contentType,
      };
    }

    const bytes = await this.#platform.readFileBytes(location.key, signal);
    reportProgress?.({
      loadedBytes: bytes.byteLength,
    });
    return {
      kind: ArtifactKind.bytes,
      bytes,
      format,
      sourceId: this.id,
    };
  }

  readonly #downloads = new Map<string, DownloadedFileEntry>();
  readonly #platform: MinigamePlatformAdapter;

  async #acquireDownloadedFile(
    url: string,
    signal: AbortSignal,
  ): Promise<AcquiredDownloadedFile> {
    while (true) {
      let entry = this.#downloads.get(url);
      if (entry === undefined) {
        entry = this.#createDownloadedFileEntry(url);
        this.#downloads.set(url, entry);
      }

      try {
        return await entry.acquire(signal);
      } catch (error) {
        if (!(error instanceof ExpiredDownloadError)) {
          throw error;
        }
      }
    }
  }

  #createDownloadedFileEntry(url: string): DownloadedFileEntry {
    const entry = new DownloadedFileEntry(
      this.#platform,
      url,
      () => {
        if (this.#downloads.get(url) === entry) {
          this.#downloads.delete(url);
        }
      },
    );
    return entry;
  }
}

interface AcquiredDownloadedFile {
  readonly file: MinigameDownloadedFile;
  readonly lease: ArtifactLease;
}

interface SharedDownloadedFile {
  readonly file: MinigameDownloadedFile;
  readonly lifetime: ArtifactLeaseOwner;
  readonly rootLease: ArtifactLease;
}

class DownloadedFileEntry {
  constructor(
    platform: MinigamePlatformAdapter,
    url: string,
    onUnavailable: () => void,
  ) {
    this.#onUnavailable = onUnavailable;
    this.#promise = platform.downloadFile(
      url,
      this.#abortController.signal,
    ).then((file) => {
      const lifetime = new ArtifactLeaseOwner(() => {
        this.#onUnavailable();
        return platform.removeFile(file.path);
      });
      const shared = {
        file,
        lifetime,
        rootLease: lifetime.acquire(),
      };
      this.#shared = shared;
      return shared;
    }).catch((error: unknown) => {
      this.#onUnavailable();
      throw error;
    }).finally(() => {
      this.#settled = true;
      this.#releaseRootIfUnobserved();
    });
  }

  async acquire(
    signal: AbortSignal,
  ): Promise<AcquiredDownloadedFile> {
    this.#waiterCount += 1;
    try {
      const shared = await waitForDownload(this.#promise, signal);
      const lease = shared.lifetime.tryAcquire();
      if (lease === undefined) {
        throw new ExpiredDownloadError();
      }
      return {
        file: shared.file,
        lease,
      };
    } finally {
      this.#waiterCount -= 1;
      if (this.#waiterCount === 0 && !this.#settled) {
        this.#abortController.abort();
      }
      this.#releaseRootIfUnobserved();
    }
  }

  readonly #abortController = new AbortController();
  readonly #onUnavailable: () => void;
  readonly #promise: Promise<SharedDownloadedFile>;
  #rootReleased = false;
  #settled = false;
  #shared: SharedDownloadedFile | undefined;
  #waiterCount = 0;

  #releaseRootIfUnobserved(): void {
    if (
      this.#rootReleased
      || !this.#settled
      || this.#waiterCount !== 0
      || this.#shared === undefined
    ) {
      return;
    }
    this.#rootReleased = true;
    this.#shared.rootLease.release();
  }
}

class ExpiredDownloadError extends Error {
  constructor(options?: ConstructorParameters<typeof Error>[1]) {
    super(
      'The downloaded mini-game file expired before it could be retained.',
      options,
    );
    this.name = 'ExpiredDownloadError';
  }
}

function waitForDownload<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(createMinigameAbortError());
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => {
      signal.removeEventListener('abort', abort);
    };
    const abort = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(createMinigameAbortError());
    };
    signal.addEventListener('abort', abort, { once: true });
    void promise.then(
      (value) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

function normalizeFormat(format: string): string {
  const normalized = format.startsWith('.')
    ? format.slice(1).toLowerCase()
    : format.toLowerCase();
  return normalized === 'jpg' ? 'jpeg' : normalized;
}

function isHttpUrl(key: string): boolean {
  return key.startsWith('https://') || key.startsWith('http://');
}
