import {
  AbortController,
  type AbortSignal,
} from '@cyclonium/abort-controller';

export class AssetScope {
  get disposed(): boolean {
    return this.#abortController.signal.aborted;
  }

  get signal(): AbortSignal {
    return this.#abortController.signal;
  }

  dispose(): void {
    this.#abortController.abort();
  }

  readonly #abortController = new AbortController();
}
