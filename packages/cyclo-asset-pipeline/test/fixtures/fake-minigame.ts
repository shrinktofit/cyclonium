import type {
  AlipayImage,
  AlipayMinigameApi,
} from '@/platform/alipay/alipay-platform-adapter.js';
import type {
  HeaderStyleDownloadTask,
  HeaderStyleImage,
  HeaderStyleMinigameApi,
} from '@/platform/minigame-shared/header-style-platform-adapter.js';
import type {
  MinigameAbortableTask,
} from '@/platform/minigame-shared/minigame-platform-adapter.js';

type HeaderRequestOptions = Parameters<
  HeaderStyleMinigameApi['request']
>[0];
type HeaderDownloadOptions = Parameters<
  HeaderStyleMinigameApi['downloadFile']
>[0];
type AlipayRequestOptions = Parameters<
  AlipayMinigameApi['request']
>[0];
type AlipayDownloadOptions = Parameters<
  AlipayMinigameApi['downloadFile']
>[0];

export class FakeHeaderStyleMinigameApi implements HeaderStyleMinigameApi {
  constructor(downloadPath: string) {
    this.#downloadPath = downloadPath;
  }

  abortCount = 0;
  deferDownloads = false;
  deferRequests = false;
  downloadCount = 0;
  downloadStatus = 200;
  readonly imageSources: string[] = [];
  readonly fontSources: string[] = [];
  readonly removedFiles: string[] = [];
  lastDownload: HeaderDownloadOptions | undefined;
  lastRequest: HeaderRequestOptions | undefined;
  requestStatus = 200;

  request(
    options: HeaderRequestOptions,
  ): MinigameAbortableTask {
    this.lastRequest = options;
    if (this.deferRequests) {
      this.#pendingRequests.push(options);
    } else {
      queueMicrotask(() => {
        this.#completeRequest(options);
      });
    }
    return this.#createTask();
  }

  downloadFile(
    options: HeaderDownloadOptions,
  ): HeaderStyleDownloadTask {
    this.lastDownload = options;
    this.downloadCount += 1;
    let headersReceived:
    ((result: {
      readonly header: Readonly<Record<string, string | number>>;
    }) => void) | undefined;
    const complete = (): void => {
      headersReceived?.({
        header: {
          'content-type': contentTypeForUrl(options.url),
        },
      });
      options.success({
        statusCode: this.downloadStatus,
        tempFilePath: this.#downloadPath,
      });
    };
    if (this.deferDownloads) {
      this.#pendingDownloads.push(complete);
    } else {
      queueMicrotask(complete);
    }
    return {
      abort: () => {
        this.abortCount += 1;
      },
      onHeadersReceived: (listener) => {
        headersReceived = listener;
      },
    };
  }

  getFileSystemManager(): ReturnType<
    HeaderStyleMinigameApi['getFileSystemManager']
  > {
    return {
      readFile: (options) => {
        queueMicrotask(() => {
          options.success({
            data: bytesForUrl(options.filePath),
          });
        });
      },
      unlink: (options) => {
        this.removedFiles.push(options.filePath);
        queueMicrotask(options.success);
      },
    };
  }

  createImage(): HeaderStyleImage {
    return createFakeImage(this.imageSources);
  }

  loadFont(path: string): string {
    this.fontSources.push(path);
    return `FakeFont_${this.fontSources.length}`;
  }

  completeDeferredRequests(): void {
    for (const request of this.#pendingRequests.splice(0)) {
      request.success({
        data: bytesForUrl(request.url),
        header: {
          'content-type': contentTypeForUrl(request.url),
        },
        statusCode: this.requestStatus,
      });
    }
  }

  completeDeferredDownloads(): void {
    for (const complete of this.#pendingDownloads.splice(0)) {
      complete();
    }
  }

  readonly #downloadPath: string;
  readonly #pendingDownloads: Array<() => void> = [];
  readonly #pendingRequests: HeaderRequestOptions[] = [];

  #completeRequest(options: HeaderRequestOptions): void {
    options.success({
      data: bytesForUrl(options.url),
      header: {
        'content-type': contentTypeForUrl(options.url),
      },
      statusCode: this.requestStatus,
    });
  }

  #createTask(): MinigameAbortableTask {
    return {
      abort: () => {
        this.abortCount += 1;
      },
    };
  }
}

export class FakeAlipayMinigameApi implements AlipayMinigameApi {
  constructor(downloadPath: string) {
    this.#downloadPath = downloadPath;
  }

  abortCount = 0;
  deferDownloads = false;
  deferRequests = false;
  downloadCount = 0;
  readonly imageSources: string[] = [];
  readonly fontSources: string[] = [];
  readonly removedFiles: string[] = [];
  lastDownload: AlipayDownloadOptions | undefined;
  lastRequest: AlipayRequestOptions | undefined;
  requestStatus = 200;

  request(
    options: AlipayRequestOptions,
  ): MinigameAbortableTask {
    this.lastRequest = options;
    if (this.deferRequests) {
      this.#pendingRequests.push(options);
    } else {
      queueMicrotask(() => {
        this.#completeRequest(options);
      });
    }
    return this.#createTask();
  }

  downloadFile(
    options: AlipayDownloadOptions,
  ): MinigameAbortableTask {
    this.lastDownload = options;
    this.downloadCount += 1;
    const complete = (): void => {
      options.success({
        apFilePath: this.#downloadPath,
      });
    };
    if (this.deferDownloads) {
      this.#pendingDownloads.push(complete);
    } else {
      queueMicrotask(complete);
    }
    return this.#createTask();
  }

  getFileSystemManager(): ReturnType<
    AlipayMinigameApi['getFileSystemManager']
  > {
    return {
      readFile: (options) => {
        queueMicrotask(() => {
          options.success({
            data: bytesForUrl(options.filePath),
          });
        });
      },
      unlink: (options) => {
        this.removedFiles.push(options.filePath);
        queueMicrotask(options.success);
      },
    };
  }

  createImage(): AlipayImage {
    return createFakeImage(this.imageSources);
  }

  loadFont(path: string): string {
    this.fontSources.push(path);
    return `FakeFont_${this.fontSources.length}`;
  }

  completeDeferredRequests(): void {
    for (const request of this.#pendingRequests.splice(0)) {
      request.success({
        data: bytesForUrl(request.url),
        status: this.requestStatus,
        headers: {
          'content-type': contentTypeForUrl(request.url),
        },
      });
    }
  }

  completeDeferredDownloads(): void {
    for (const complete of this.#pendingDownloads.splice(0)) {
      complete();
    }
  }

  readonly #downloadPath: string;
  readonly #pendingDownloads: Array<() => void> = [];
  readonly #pendingRequests: AlipayRequestOptions[] = [];

  #completeRequest(options: AlipayRequestOptions): void {
    options.success({
      data: bytesForUrl(options.url),
      status: this.requestStatus,
      headers: {
        'content-type': contentTypeForUrl(options.url),
      },
    });
  }

  #createTask(): MinigameAbortableTask {
    return {
      abort: () => {
        this.abortCount += 1;
      },
    };
  }
}

function createFakeImage(
  imageSources: string[],
): HeaderStyleImage & AlipayImage {
  let source = '';
  const image: HeaderStyleImage & AlipayImage = {
    get src(): string {
      return source;
    },
    set src(value: string) {
      source = value;
      imageSources.push(value);
      queueMicrotask(() => {
        image.onload();
      });
    },
    onload: () => undefined,
    onerror: () => undefined,
  };
  return image;
}

function bytesForUrl(url: string): ArrayBuffer {
  const text = url.endsWith('.json')
    ? JSON.stringify({ source: url })
    : `text:${url}`;
  return new TextEncoder().encode(text).buffer;
}

function contentTypeForUrl(url: string): string {
  if (url.endsWith('.json')) {
    return 'application/json';
  }
  if (url.endsWith('.php')) {
    return 'image/png';
  }
  if (url.endsWith('.png')) {
    return 'image/png';
  }
  if (url.endsWith('.mp3')) {
    return 'audio/mpeg';
  }
  return 'text/plain';
}
