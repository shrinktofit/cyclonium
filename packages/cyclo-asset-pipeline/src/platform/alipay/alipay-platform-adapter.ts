import type { AbortSignal } from '@cyclonium/abort-controller';

import {
  bytesFromArrayBuffer,
  contentTypeFromHeaders,
  createMinigameAbortError,
  type MinigameAbortableTask,
  type MinigameByteResponse,
  type MinigameDownloadedFile,
  MinigameHttpResponseError,
  type MinigamePlatformAdapter,
  runAbortable,
} from '../minigame-shared/minigame-platform-adapter.js';

export interface AlipayFailure {
  readonly errorMessage: string;
}

export interface AlipayImage {
  src: string;
  onload: () => void;
  onerror: (event: unknown) => void;
}

export interface AlipayFileSystem {
  readFile(options: {
    readonly filePath: string;
    readonly encoding: '';
    readonly success: (result: { readonly data: ArrayBuffer }) => void;
    readonly fail: (failure: AlipayFailure) => void;
  }): void;

  unlink(options: {
    readonly filePath: string;
    readonly success: () => void;
    readonly fail: (failure: AlipayFailure) => void;
  }): void;
}

export interface AlipayMinigameApi {
  request(options: {
    readonly url: string;
    readonly method: 'GET';
    readonly dataType: 'arraybuffer';
    readonly success: (result: {
      readonly data: ArrayBuffer;
      readonly status: number;
      readonly headers?: Readonly<Record<string, string | number>>;
    }) => void;
    readonly fail: (failure: AlipayFailure) => void;
  }): MinigameAbortableTask;

  downloadFile(options: {
    readonly url: string;
    readonly success: (result: { readonly apFilePath: string }) => void;
    readonly fail: (failure: AlipayFailure) => void;
  }): MinigameAbortableTask;

  getFileSystemManager(): AlipayFileSystem;
  createImage(): AlipayImage;
  loadFont(path: string): string;
}

export class AlipayPlatformAdapter implements MinigamePlatformAdapter {
  constructor(api: AlipayMinigameApi) {
    this.#api = api;
  }

  readonly id = 'alipay';

  requestBytes(
    url: string,
    signal: AbortSignal,
  ): Promise<MinigameByteResponse> {
    return runAbortable(signal, (resolve, reject) => this.#api.request({
      url,
      method: 'GET',
      dataType: 'arraybuffer',
      success: (result) => {
        if (result.status < 200 || result.status > 299) {
          reject(new MinigameHttpResponseError(url, result.status));
          return;
        }
        resolve({
          bytes: bytesFromArrayBuffer(result.data),
          contentType: result.headers === undefined
            ? undefined
            : contentTypeFromHeaders(result.headers),
        });
      },
      fail: (failure) => {
        reject(new Error(failure.errorMessage));
      },
    }));
  }

  readFileBytes(
    path: string,
    signal: AbortSignal,
  ): Promise<Uint8Array> {
    return runAbortable(signal, (resolve, reject) => {
      this.#api.getFileSystemManager().readFile({
        filePath: path,
        encoding: '',
        success: (result) => {
          resolve(bytesFromArrayBuffer(result.data));
        },
        fail: (failure) => {
          reject(new Error(failure.errorMessage));
        },
      });
      return undefined;
    });
  }

  downloadFile(
    url: string,
    signal: AbortSignal,
  ): Promise<MinigameDownloadedFile> {
    return runAbortable(signal, (resolve, reject) => this.#api.downloadFile({
      url,
      success: (result) => {
        if (result.apFilePath.length === 0) {
          reject(new Error(
            `Alipay mini-game download for "${url}" returned no file path.`,
          ));
          return;
        }
        resolve({ path: result.apFilePath });
      },
      fail: (failure) => {
        reject(new Error(failure.errorMessage));
      },
    }), (file) => {
      void this.removeFile(file.path).catch(() => undefined);
    });
  }

  createImage(
    path: string,
    signal: AbortSignal,
  ): Promise<object> {
    return new Promise<object>((resolve, reject) => {
      const image = this.#api.createImage();
      let settled = false;

      const cleanup = (): void => {
        signal.removeEventListener('abort', abort);
        image.onload = () => undefined;
        image.onerror = () => undefined;
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
      if (signal.aborted) {
        abort();
        return;
      }

      image.onload = () => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(image);
      };
      image.onerror = (event) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(event instanceof Error
          ? event
          : new Error(`Failed to decode Alipay mini-game image "${path}".`));
      };
      image.src = path;
    });
  }

  loadFont(path: string): string {
    return this.#api.loadFont(path);
  }

  removeFile(path: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.#api.getFileSystemManager().unlink({
        filePath: path,
        success: resolve,
        fail: (failure) => {
          reject(new Error(failure.errorMessage));
        },
      });
    });
  }

  readonly #api: AlipayMinigameApi;
}
