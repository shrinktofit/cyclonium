import { CCObject } from 'cc';

declare module 'cc' {
  interface CCObject {
    /** All engine object flags, including lifecycle and editor flags. */
    objectFlags: number;
  }
}

Object.defineProperty(CCObject.prototype, 'objectFlags', {
  enumerable: false,
  configurable: true,
  get(this: CCObject): number {
    return this._objFlags;
  },
  set(this: CCObject, value: number) {
    this._objFlags = value;
  },
});
