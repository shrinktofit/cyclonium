import type { AbortSignal } from '@cyclonium/abort-controller';

import {
  AssetLoadCancelledError,
  LoadHandleState,
  type AssetHandle,
  type AssetId,
  type CycloAsset,
} from './public.js';

type CloseLoadingHandle<TAsset extends CycloAsset> = (
  handle: AssetHandleImpl<TAsset>,
) => void;

type RetainReadyAsset<TAsset extends CycloAsset> = (
  asset: TAsset,
) => () => void;

export class AssetHandleImpl<TAsset extends CycloAsset> implements AssetHandle<TAsset> {
  constructor(
    id: AssetId,
    abortSignals: readonly AbortSignal[],
    closeLoadingHandle: CloseLoadingHandle<TAsset>,
    retainReadyAsset?: RetainReadyAsset<TAsset>,
    releaseLoadingReservation?: () => void,
  ) {
    this.id = id;
    this.#abortSignals = Array.from(new Set(abortSignals));
    this.#closeLoadingHandle = closeLoadingHandle;
    this.#retainReadyAsset = retainReadyAsset;
    this.#releaseLoadingReservation = releaseLoadingReservation;

    let resolveReady!: (asset: TAsset) => void;
    let rejectReady!: (reason: unknown) => void;
    this.ready = new Promise<TAsset>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    this.#readyResolve = resolveReady;
    this.#readyReject = rejectReady;

    for (const signal of this.#abortSignals) {
      signal.addEventListener('abort', this.#onAbort, {
        once: true,
      });
    }

    if (this.#abortSignals.some((signal) => signal.aborted)) {
      this.cancel();
    }
  }

  readonly id: AssetId;
  readonly ready: Promise<TAsset>;

  get state(): LoadHandleState {
    return this.#state;
  }

  get value(): TAsset | undefined {
    return this.#value;
  }

  release(): void {
    if (this.#state === LoadHandleState.released) {
      return;
    }

    try {
      if (this.#state === LoadHandleState.loading) {
        this.#closeLoadingHandle(this);
        this.#releasePendingReservation();
        this.#readyReject(new AssetLoadCancelledError(this.id));
      }

      this.#releaseReadyValue();
    } finally {
      this.#removeAbortListeners();
      this.#state = LoadHandleState.released;
    }
  }

  cancel(): void {
    if (
      this.#state === LoadHandleState.cancelled
      || this.#state === LoadHandleState.released
      || this.#state === LoadHandleState.failed
    ) {
      return;
    }

    try {
      if (this.#state === LoadHandleState.loading) {
        this.#closeLoadingHandle(this);
        this.#releasePendingReservation();
        this.#readyReject(new AssetLoadCancelledError(this.id));
      }

      this.#releaseReadyValue();
    } finally {
      this.#removeAbortListeners();
      this.#state = LoadHandleState.cancelled;
    }
  }

  resolve(asset: TAsset): void {
    if (this.#state !== LoadHandleState.loading) {
      return;
    }

    try {
      this.#releaseReadyAsset = this.#retainReadyAsset?.(asset);
    } catch (error) {
      this.#releasePendingReservation();
      this.reject(error);
      return;
    }

    this.#releasePendingReservation();
    this.#value = asset;
    this.#state = LoadHandleState.ready;
    this.#readyResolve(asset);
  }

  reject(error: unknown): void {
    if (this.#state !== LoadHandleState.loading) {
      return;
    }

    this.#releasePendingReservation();
    this.#removeAbortListeners();
    this.#state = LoadHandleState.failed;
    this.#readyReject(error);
  }

  readonly #abortSignals: readonly AbortSignal[];
  readonly #closeLoadingHandle: CloseLoadingHandle<TAsset>;
  readonly #readyReject: (reason: unknown) => void;
  readonly #readyResolve: (asset: TAsset) => void;
  readonly #releaseLoadingReservation: (() => void) | undefined;
  readonly #retainReadyAsset: RetainReadyAsset<TAsset> | undefined;
  #releaseReadyAsset: (() => void) | undefined;
  #state = LoadHandleState.loading;
  #value: TAsset | undefined;

  readonly #onAbort = (): void => {
    this.cancel();
  };

  #releaseReadyValue(): void {
    this.#value = undefined;
    const releaseReadyAsset = this.#releaseReadyAsset;
    this.#releaseReadyAsset = undefined;
    releaseReadyAsset?.();
  }

  #releasePendingReservation(): void {
    this.#releaseLoadingReservation?.();
  }

  #removeAbortListeners(): void {
    for (const signal of this.#abortSignals) {
      signal.removeEventListener('abort', this.#onAbort);
    }
  }
}
