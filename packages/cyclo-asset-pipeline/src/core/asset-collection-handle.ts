import type { AbortSignal } from '@cyclonium/abort-controller';

import type {
  AssetCollectionHandle,
  AssetHandle,
  AssetId,
  CycloAsset,
} from './public.js';
import {
  AssetLoadCancelledError,
  LoadHandleState,
} from './public.js';

export class AssetCollectionHandleImpl<TAsset extends CycloAsset> implements AssetCollectionHandle<TAsset> {
  constructor(
    keys: readonly AssetId[],
    handles: ReadonlyArray<AssetHandle<TAsset>>,
    abortSignals: readonly AbortSignal[],
  ) {
    this.keys = Object.freeze([...keys]);
    this.#handles = handles;
    this.#abortSignals = Array.from(new Set(abortSignals));
    this.ready = this.#load();
    for (const signal of this.#abortSignals) {
      signal.addEventListener('abort', this.#onAbort, { once: true });
    }
    if (this.#abortSignals.some((signal) => signal.aborted)) {
      this.#cancel();
    }
  }

  readonly keys: readonly AssetId[];
  readonly ready: Promise<readonly TAsset[]>;

  get state(): LoadHandleState {
    return this.#state;
  }

  get values(): readonly TAsset[] | undefined {
    return this.#values;
  }

  release(): void {
    if (this.#state === LoadHandleState.released) {
      return;
    }

    this.#state = LoadHandleState.released;
    this.#values = undefined;
    this.#removeAbortListeners();
    for (const handle of this.#handles) {
      handle.release();
    }
  }

  readonly #abortSignals: readonly AbortSignal[];
  readonly #handles: ReadonlyArray<AssetHandle<TAsset>>;
  #state = LoadHandleState.loading;
  #values: readonly TAsset[] | undefined;

  readonly #onAbort = (): void => {
    this.#cancel();
  };

  async #load(): Promise<readonly TAsset[]> {
    try {
      const values = Object.freeze(await Promise.all(
        this.#handles.map((handle) => handle.ready),
      ));
      if (this.#state !== LoadHandleState.loading) {
        throw new AssetLoadCancelledError(
          this.keys[0] ?? 'asset-collection',
        );
      }
      this.#values = values;
      this.#state = LoadHandleState.ready;
      return values;
    } catch (error) {
      if (this.#state === LoadHandleState.loading) {
        this.#state = this.#handles.some((handle) => (
          handle.state === LoadHandleState.cancelled
          || handle.state === LoadHandleState.released
        ))
          ? LoadHandleState.cancelled
          : LoadHandleState.failed;
      }
      this.#values = undefined;
      this.#removeAbortListeners();
      for (const handle of this.#handles) {
        handle.release();
      }
      throw error;
    }
  }

  #cancel(): void {
    if (
      this.#state === LoadHandleState.cancelled
      || this.#state === LoadHandleState.failed
      || this.#state === LoadHandleState.released
    ) {
      return;
    }
    this.#state = LoadHandleState.cancelled;
    this.#values = undefined;
    this.#removeAbortListeners();
    for (const handle of this.#handles) {
      handle.release();
    }
  }

  #removeAbortListeners(): void {
    for (const signal of this.#abortSignals) {
      signal.removeEventListener('abort', this.#onAbort);
    }
  }
}
