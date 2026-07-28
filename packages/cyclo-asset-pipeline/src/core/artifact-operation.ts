import {
  AbortController,
  type AbortSignal,
} from '@cyclonium/abort-controller';

import {
  releaseArtifact,
  retainArtifact,
} from './artifact-lifetime.js';
import type { Artifact } from './model.js';

interface ArtifactConsumer {
  readonly reject: (error: unknown) => void;
  readonly resolve: (artifact: Artifact) => void;
  readonly signal: AbortSignal;
  readonly onAbort: () => void;
}

class ArtifactOperation {
  constructor(
    execute: (signal: AbortSignal) => Promise<Artifact>,
    onClosed: (operation: ArtifactOperation) => void,
  ) {
    this.#onClosed = onClosed;

    let result: Promise<Artifact>;
    try {
      result = execute(this.#abortController.signal);
    } catch (error) {
      result = Promise.reject(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
    void result.then(
      (artifact) => {
        if (this.#closed) {
          releaseArtifact(artifact);
          return;
        }
        this.#settle((consumer) => {
          consumer.resolve(retainArtifact(artifact));
        });
        releaseArtifact(artifact);
      },
      (error: unknown) => {
        this.#settle((consumer) => {
          consumer.reject(error);
        });
      },
    );
  }

  acquire(signal: AbortSignal): Promise<Artifact> {
    if (this.#closed) {
      return Promise.reject(new Error(
        'A closed Artifact operation cannot accept consumers.',
      ));
    }
    if (signal.aborted) {
      this.#cancelIfUnobserved();
      return Promise.reject(createAbortError());
    }

    return new Promise<Artifact>((resolve, reject) => {
      const consumer: ArtifactConsumer = {
        reject,
        resolve,
        signal,
        onAbort: () => {
          if (!this.#consumers.delete(consumer)) {
            return;
          }
          signal.removeEventListener('abort', consumer.onAbort);
          reject(createAbortError());
          this.#cancelIfUnobserved();
        },
      };
      this.#consumers.add(consumer);
      signal.addEventListener('abort', consumer.onAbort, {
        once: true,
      });
      if (signal.aborted) {
        consumer.onAbort();
      }
    });
  }

  readonly #abortController = new AbortController();
  readonly #consumers = new Set<ArtifactConsumer>();
  readonly #onClosed: (operation: ArtifactOperation) => void;
  #closed = false;

  #cancelIfUnobserved(): void {
    if (this.#consumers.size !== 0 || this.#closed) {
      return;
    }
    this.#closed = true;
    this.#abortController.abort();
    this.#onClosed(this);
  }

  #settle(
    deliver: (consumer: ArtifactConsumer) => void,
  ): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#onClosed(this);

    const consumers = Array.from(this.#consumers);
    this.#consumers.clear();
    for (const consumer of consumers) {
      consumer.signal.removeEventListener('abort', consumer.onAbort);
      deliver(consumer);
    }
  }
}

export class ArtifactOperationStore {
  acquire(
    key: string,
    signal: AbortSignal,
    execute: (signal: AbortSignal) => Promise<Artifact>,
  ): Promise<Artifact> {
    let operation = this.#operations.get(key);
    if (operation === undefined) {
      operation = new ArtifactOperation(execute, (closedOperation) => {
        if (this.#operations.get(key) === closedOperation) {
          this.#operations.delete(key);
        }
      });
      this.#operations.set(key, operation);
    }
    return operation.acquire(signal);
  }

  readonly #operations = new Map<string, ArtifactOperation>();
}

function createAbortError(): Error {
  const error = new Error('Artifact acquisition was aborted.');
  error.name = 'AbortError';
  return error;
}
