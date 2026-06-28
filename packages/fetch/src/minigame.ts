/// <reference types="minigame-api-typings" />

import type { Headers, HeadersIterator, RequestInit, Response } from './common.js';
import { minigameGlobal } from '@cyclonium/minigame-globals';

export function fetch(url: string, init: RequestInit) {
  return new Promise<Response>((resolve, reject) => {
    const requestTask = minigameGlobal.request({
      url,
      dataType: '其他', // Don't let wx do parsing
      responseType: init._binary ? 'arraybuffer' : 'text',
      method: init?.method ?? 'GET',
      header: init?.headers,
      success(res) {
        resolve(new ResponseImpl(res));
      },
      fail(err) {
        reject(new Error(err.errMsg));
      },
    });
  });
}

class HeadersImpl implements Headers {
  constructor(headers: Record<string, string> = {}) {
    this._headers = headers;
  }

  append(name: string, value: string): void {
    this._headers[name] = value;
  }

  delete(name: string): void {
    delete this._headers[name];
  }

  get(name: string): string | null {
    return this._headers[name] ?? null;
  }

  has(name: string): boolean {
    return name in this._headers;
  }

  set(name: string, value: string): void {
    this._headers[name] = value;
  }

  forEach(callbackfn: (value: string, key: string, parent: Headers) => void, thisArg?: unknown): void {
    Object.entries(this._headers).forEach(([key, value]) => {
      callbackfn.call(thisArg, value, key, this);
    });
  }

  * entries(): HeadersIterator<[string, string]> {
    yield* Object.entries(this._headers);
  }

  * keys(): HeadersIterator<string> {
    yield* Object.keys(this._headers);
  }

  * values(): HeadersIterator<string> {
    yield* Object.values(this._headers);
  }

  [Symbol.iterator](): HeadersIterator<[string, string]> {
    return this.entries();
  }

  private _headers: Record<string, string>;
}

class ResponseImpl implements Response {
  constructor(
    wxRequestResult: WechatMinigame.RequestSuccessCallbackResult,
  ) {
    this._statusCode = wxRequestResult.statusCode;
    const headers = new HeadersImpl(wxRequestResult.header);
    this._headers = headers;
    if (!(typeof wxRequestResult.data === 'string' || wxRequestResult.data instanceof ArrayBuffer)) {
      throw new Error('wxRequestResult.data is not string or ArrayBuffer');
    }
    this._data = wxRequestResult.data;
  }

  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/Response/status
   */
  get status() {
    return this._statusCode;
  }

  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/Response/statusText
   */
  get statusText() {
    return `NOT IMPLEMENTED ${this._statusCode}`;
  }

  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/Response/ok
   */
  get ok() {
    return this._statusCode >= 200 && this._statusCode <= 299;
  }

  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/Response/headers
   */
  get headers(): Headers {
    return this._headers;
  }

  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/Response/text
   */
  async text(): Promise<string> {
    if (typeof this._data === 'string') {
      return this._data;
    }
    throw new Error('this._data is not string');
  }

  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/Response/json
   */
  async json(): Promise<unknown> {
    if (typeof this._data === 'string') {
      return JSON.parse(this._data);
    }
    throw new Error('this._data is not string');
  }

  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/Response/blob
   */
  async arrayBuffer(): Promise<ArrayBuffer> {
    if (this._data instanceof ArrayBuffer) {
      return this._data;
    }
    throw new Error('this._data is not ArrayBuffer');
  }

  private _statusCode: number;
  private _headers: HeadersImpl;
  private _data: string | ArrayBuffer;
}
