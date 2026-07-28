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
} from './minigame-platform-adapter.js';

export interface HeaderStyleFailure {
  readonly errMsg: string;
}

export interface HeaderStyleRequestSuccess {
  readonly data: ArrayBuffer;
  readonly header: Readonly<Record<string, string | number>>;
  readonly statusCode: number;
}

export interface HeaderStyleDownloadSuccess {
  readonly statusCode: number;
  readonly tempFilePath?: string;
  readonly filePath?: string;
}

export interface HeaderStyleHeadersResult {
  readonly header: Readonly<Record<string, string | number>>;
}

export interface HeaderStyleDownloadTask extends MinigameAbortableTask {
  onHeadersReceived?(
    listener: (result: HeaderStyleHeadersResult) => void,
  ): void;
}

export interface HeaderStyleImage {
  src: string;
  onload: () => void;
  onerror: (event: unknown) => void;
}

export interface HeaderStyleFileSystem {
  readFile(options: {
    readonly filePath: string;
    readonly success: (result: { readonly data: ArrayBuffer }) => void;
    readonly fail: (failure: HeaderStyleFailure) => void;
  }): void;

  unlink(options: {
    readonly filePath: string;
    readonly success: () => void;
    readonly fail: (failure: HeaderStyleFailure) => void;
  }): void;
}

export interface HeaderStyleMinigameApi {
  request(options: {
    readonly url: string;
    readonly method: 'GET';
    readonly dataType: string;
    readonly responseType: 'arraybuffer';
    readonly success: (result: HeaderStyleRequestSuccess) => void;
    readonly fail: (failure: HeaderStyleFailure) => void;
  }): MinigameAbortableTask;

  downloadFile(options: {
    readonly url: string;
    readonly success: (result: HeaderStyleDownloadSuccess) => void;
    readonly fail: (failure: HeaderStyleFailure) => void;
  }): HeaderStyleDownloadTask;

  getFileSystemManager(): HeaderStyleFileSystem;
  createImage(): HeaderStyleImage;
  loadFont(path: string): string;
}

export abstract class HeaderStylePlatformAdapter implements MinigamePlatformAdapter {
  readonly id: string;

  requestBytes(
    url: string,
    signal: AbortSignal,
  ): Promise<MinigameByteResponse> {
    return runAbortable(signal, (resolve, reject) => this.#api.request({
      url,
      method: 'GET',
      dataType: this.#requestDataType,
      responseType: 'arraybuffer',
      success: (result) => {
        if (result.statusCode < 200 || result.statusCode > 299) {
          reject(new MinigameHttpResponseError(url, result.statusCode));
          return;
        }
        resolve({
          bytes: bytesFromArrayBuffer(result.data),
          contentType: contentTypeFromHeaders(result.header),
        });
      },
      fail: (failure) => {
        reject(new Error(failure.errMsg));
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
        success: (result) => {
          resolve(bytesFromArrayBuffer(result.data));
        },
        fail: (failure) => {
          reject(new Error(failure.errMsg));
        },
      });
      return undefined;
    });
  }

  downloadFile(
    url: string,
    signal: AbortSignal,
  ): Promise<MinigameDownloadedFile> {
    let contentType: string | undefined;
    return runAbortable(signal, (resolve, reject) => {
      const task = this.#api.downloadFile({
        url,
        success: (result) => {
          const path = result.tempFilePath ?? result.filePath;
          if (result.statusCode < 200 || result.statusCode > 299) {
            const error = new MinigameHttpResponseError(
              url,
              result.statusCode,
            );
            if (path === undefined || path.length === 0) {
              reject(error);
              return;
            }
            void this.removeFile(path)
              .catch(() => undefined)
              .then(() => {
                reject(error);
              });
            return;
          }

          if (path === undefined || path.length === 0) {
            reject(new Error(
              `Mini-game download for "${url}" returned no file path.`,
            ));
            return;
          }
          resolve({ path, contentType });
        },
        fail: (failure) => {
          reject(new Error(failure.errMsg));
        },
      });
      task.onHeadersReceived?.((result) => {
        contentType = contentTypeFromHeaders(result.header);
      });
      return task;
    }, (file) => {
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
          : new Error(`Failed to decode mini-game image "${path}".`));
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
          reject(new Error(failure.errMsg));
        },
      });
    });
  }

  protected constructor(
    id: string,
    api: HeaderStyleMinigameApi,
    requestDataType: string,
  ) {
    this.id = id;
    this.#api = api;
    this.#requestDataType = requestDataType;
  }

  readonly #api: HeaderStyleMinigameApi;
  readonly #requestDataType: string;
}
