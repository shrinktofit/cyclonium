import type { AbortSignal } from '@cyclonium/abort-controller';

import type { ArtifactSource } from '../../core/contracts.js';
import {
  ArtifactKind,
  type Artifact,
  type ArtifactAcquisitionProgress,
  type ArtifactLocation,
} from '../../core/model.js';

export class WebHttpResponseError extends Error {
  constructor(
    url: string,
    status: number,
    options?: ConstructorParameters<typeof Error>[1],
  ) {
    super(
      `HTTP request for "${url}" failed with status ${status}.`,
      options,
    );
    this.name = 'WebHttpResponseError';
    this.status = status;
    this.url = url;
  }

  readonly status: number;
  readonly url: string;
}

export class WebArtifactSource implements ArtifactSource {
  constructor(
    id = 'web-http',
    fetchImplementation: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.id = id;
    this.#fetch = fetchImplementation;
  }

  readonly id: string;

  async acquire(
    location: ArtifactLocation,
    signal: AbortSignal,
    reportProgress?: (progress: ArtifactAcquisitionProgress) => void,
  ): Promise<Artifact> {
    const response = await this.#fetch(location.key, {
      signal,
    });

    if (!response.ok) {
      throw new WebHttpResponseError(location.key, response.status);
    }

    return {
      kind: ArtifactKind.bytes,
      bytes: await readResponseBytes(response, signal, reportProgress),
      format: location.format,
      sourceId: this.id,
      contentType: response.headers.get('content-type') ?? undefined,
    };
  }

  readonly #fetch: typeof fetch;
}

async function readResponseBytes(
  response: Response,
  signal: AbortSignal,
  reportProgress: (
    progress: ArtifactAcquisitionProgress,
  ) => void = () => undefined,
): Promise<Uint8Array> {
  const totalBytes = parseContentLength(
    response.headers.get('content-length'),
  );
  if (response.body === null) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    reportProgress({
      loadedBytes: bytes.byteLength,
      totalBytes,
    });
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;
  try {
    while (true) {
      if (signal.aborted) {
        throw createAbortError();
      }
      const result = await reader.read();
      if (result.done) {
        break;
      }
      chunks.push(result.value);
      loadedBytes += result.value.byteLength;
      reportProgress({
        loadedBytes,
        totalBytes,
      });
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(loadedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (loadedBytes === 0) {
    reportProgress({
      loadedBytes,
      totalBytes,
    });
  }
  return bytes;
}

function parseContentLength(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed)
    ? parsed
    : undefined;
}

function createAbortError(): Error {
  const error = new Error('The Web artifact acquisition was aborted.');
  error.name = 'AbortError';
  return error;
}
