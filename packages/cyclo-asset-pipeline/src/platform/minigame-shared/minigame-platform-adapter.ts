import type { AbortSignal } from '@cyclonium/abort-controller';

export interface MinigameByteResponse {
  readonly bytes: Uint8Array;
  readonly contentType?: string;
}

export interface MinigameDownloadedFile {
  readonly path: string;
  readonly contentType?: string;
}

export interface MinigamePlatformAdapter {
  readonly id: string;

  requestBytes(
    url: string,
    signal: AbortSignal,
  ): Promise<MinigameByteResponse>;

  readFileBytes(
    path: string,
    signal: AbortSignal,
  ): Promise<Uint8Array>;

  downloadFile(
    url: string,
    signal: AbortSignal,
  ): Promise<MinigameDownloadedFile>;

  createImage(
    path: string,
    signal: AbortSignal,
  ): Promise<object>;

  loadFont(path: string): string;

  removeFile(path: string): Promise<void>;
}

export interface MinigameAbortableTask {
  abort(): void;
}

export class MinigameHttpResponseError extends Error {
  constructor(
    url: string,
    status: number,
    options?: ConstructorParameters<typeof Error>[1],
  ) {
    super(
      `HTTP request for "${url}" failed with status ${status}.`,
      options,
    );
    this.name = 'MinigameHttpResponseError';
    this.status = status;
    this.url = url;
  }

  readonly status: number;
  readonly url: string;
}

export function runAbortable<T>(
  signal: AbortSignal,
  start: (
    resolve: (value: T) => void,
    reject: (error: Error) => void,
  ) => MinigameAbortableTask | undefined,
  acceptLateResolve?: (value: T) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let task: MinigameAbortableTask | undefined;
    let taskAborted = false;

    const cleanup = (): void => {
      signal.removeEventListener('abort', abort);
    };
    const abortTask = (): void => {
      if (task === undefined || taskAborted) {
        return;
      }
      taskAborted = true;
      task.abort();
    };
    const succeed = (value: T): void => {
      if (settled) {
        acceptLateResolve?.(value);
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };
    const fail = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };
    const abort = (): void => {
      if (settled) {
        return;
      }
      fail(createMinigameAbortError());
      abortTask();
    };

    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }

    try {
      task = start(succeed, fail);
      if (signal.aborted) {
        abortTask();
        if (!settled) {
          fail(createMinigameAbortError());
        }
      }
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export function contentTypeFromHeaders(
  headers: Readonly<Record<string, string | number>>,
): string | undefined {
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === 'content-type') {
      return String(value);
    }
  }
  return undefined;
}

export function bytesFromArrayBuffer(data: ArrayBuffer): Uint8Array {
  return new Uint8Array(data);
}

export function createMinigameAbortError(): Error {
  const error = new Error('The mini-game platform operation was aborted.');
  error.name = 'AbortError';
  return error;
}
