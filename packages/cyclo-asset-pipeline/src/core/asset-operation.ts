import {
  AbortController,
  type AbortSignal,
} from '@cyclonium/abort-controller';

import { AssetHandleImpl } from './asset-handle.js';
import type { OperationKey } from './model.js';
import {
  AssetLoadError,
  LoadHandleState,
  type AssetHandle,
  type AssetId,
  type CycloAsset,
} from './public.js';

export enum AssetOperationState {
  pending = 'pending',
  running = 'running',
  ready = 'ready',
  failed = 'failed',
  cancelled = 'cancelled',
}

export type AssetOperationExecutor<TAsset extends CycloAsset> = (
  signal: AbortSignal,
) => Promise<TAsset>;

export interface AssetOperationConsumerOptions<
  TAsset extends CycloAsset,
> {
  readonly afterDelivery?: () => void;
  readonly disposeUnclaimed?: (asset: TAsset) => void;
  readonly releaseLoadingReservation?: () => void;
  readonly signals?: readonly AbortSignal[];
  readonly retain?: (asset: TAsset) => () => void;
}

export function encodeOperationKey(key: OperationKey): string {
  return JSON.stringify([
    key.resourceId,
    key.recordRevision,
    key.runtimeVariant,
  ]);
}

class AssetOperation<TAsset extends CycloAsset> {
  constructor(
    execute: AssetOperationExecutor<TAsset>,
    afterDelivery: () => void,
    disposeUnclaimed: (asset: TAsset) => void,
    onClosed: (operation: AssetOperation<TAsset>) => void,
  ) {
    this.#afterDelivery = afterDelivery;
    this.#execute = execute;
    this.#disposeUnclaimed = disposeUnclaimed;
    this.#onClosed = onClosed;
  }

  get state(): AssetOperationState {
    return this.#state;
  }

  get acceptingConsumers(): boolean {
    return this.#state === AssetOperationState.pending
      || this.#state === AssetOperationState.running;
  }

  createHandle(
    assetId: AssetId,
    options: AssetOperationConsumerOptions<TAsset>,
  ): AssetHandle<TAsset> {
    if (!this.acceptingConsumers) {
      throw new Error('A closed asset operation cannot accept consumers.');
    }

    const handle = new AssetHandleImpl(
      assetId,
      options.signals ?? [],
      (closedHandle) => {
        this.#detachConsumer(closedHandle);
      },
      options.retain,
      options.releaseLoadingReservation,
    );

    if (handle.state === LoadHandleState.loading) {
      this.#consumers.add(handle);
      this.#start();
    } else if (this.#consumers.size === 0) {
      this.#cancel();
    }

    return handle;
  }

  readonly #abortController = new AbortController();
  readonly #afterDelivery: () => void;
  readonly #consumers = new Set<AssetHandleImpl<TAsset>>();
  readonly #disposeUnclaimed: (asset: TAsset) => void;
  readonly #execute: AssetOperationExecutor<TAsset>;
  readonly #onClosed: (operation: AssetOperation<TAsset>) => void;
  #state = AssetOperationState.pending;

  #start(): void {
    if (this.#state !== AssetOperationState.pending) {
      return;
    }

    this.#state = AssetOperationState.running;

    let execution: Promise<TAsset>;
    try {
      execution = this.#execute(this.#abortController.signal);
    } catch (error) {
      this.#fail(error);
      return;
    }

    void execution.then(
      (asset) => {
        this.#succeed(asset);
      },
      (error: unknown) => {
        this.#fail(error);
      },
    );
  }

  #detachConsumer(handle: AssetHandleImpl<TAsset>): void {
    this.#consumers.delete(handle);
    if (this.#consumers.size === 0 && this.acceptingConsumers) {
      this.#cancel();
    }
  }

  #cancel(): void {
    if (!this.acceptingConsumers) {
      return;
    }

    this.#state = AssetOperationState.cancelled;
    this.#abortController.abort();
    this.#onClosed(this);
  }

  #succeed(asset: TAsset): void {
    if (this.#state !== AssetOperationState.running) {
      this.#disposeUnclaimed(asset);
      return;
    }

    this.#state = AssetOperationState.ready;
    this.#onClosed(this);

    const consumers = Array.from(this.#consumers);
    this.#consumers.clear();
    try {
      for (const consumer of consumers) {
        consumer.resolve(asset);
      }
    } finally {
      this.#afterDelivery();
    }
  }

  #fail(error: unknown): void {
    if (this.#state !== AssetOperationState.running) {
      return;
    }

    this.#state = AssetOperationState.failed;
    this.#abortController.abort();
    this.#onClosed(this);

    const consumers = Array.from(this.#consumers);
    this.#consumers.clear();
    for (const consumer of consumers) {
      consumer.reject(errorForConsumer(error, consumer.id));
    }
  }
}

function errorForConsumer(error: unknown, assetId: AssetId): unknown {
  if (!(error instanceof AssetLoadError) || error.assetId === assetId) {
    return error;
  }
  return new AssetLoadError(
    assetId,
    error.stage,
    error.message,
    { cause: error.cause },
  );
}

export class AssetOperationStore {
  get size(): number {
    return this.#operations.size;
  }

  acquire<TAsset extends CycloAsset>(
    key: OperationKey,
    assetId: AssetId,
    execute: AssetOperationExecutor<TAsset>,
    options: AssetOperationConsumerOptions<TAsset> = {},
  ): AssetHandle<TAsset> {
    const encodedKey = encodeOperationKey(key);
    const existing = this.#operations.get(encodedKey) as
      | AssetOperation<TAsset>
      | undefined;

    let operation: AssetOperation<TAsset>;
    if (existing?.acceptingConsumers === true) {
      operation = existing;
    } else {
      operation = new AssetOperation<TAsset>(
        execute,
        options.afterDelivery ?? (() => undefined),
        options.disposeUnclaimed ?? (() => undefined),
        (closedOperation) => {
          const current = this.#operations.get(encodedKey);
          if (current === closedOperation) {
            this.#operations.delete(encodedKey);
          }
        },
      );
      this.#operations.set(encodedKey, operation);
    }

    return operation.createHandle(assetId, options);
  }

  readonly #operations = new Map<string, unknown>();
}
