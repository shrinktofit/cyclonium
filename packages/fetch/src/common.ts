export type HeadersInit = Record<string, string>;

export interface RequestInit {
  _binary: boolean;
  method?:
    | 'OPTIONS'
    | 'GET'
    | 'HEAD'
    | 'POST'
    | 'PUT'
    | 'DELETE'
    | 'TRACE'
    | 'CONNECT';
  headers?: HeadersInit;
}

export interface Headers {
  append(name: string, value: string): void;
  delete(name: string): void;
  get(name: string): string | null;
  has(name: string): boolean;
  set(name: string, value: string): void;
  forEach(callbackfn: (value: string, key: string, parent: Headers) => void, thisArg?: unknown): void;
  entries(): HeadersIterator<[string, string]>;
  keys(): HeadersIterator<string>;
  values(): HeadersIterator<string>;
}

export interface HeadersIterator<T> extends IteratorObject<T, BuiltinIteratorReturn, unknown> {
  [Symbol.iterator](): HeadersIterator<T>;
}

export interface Response {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Headers;
  text(): Promise<string>;
  json(): Promise<unknown>;
}
