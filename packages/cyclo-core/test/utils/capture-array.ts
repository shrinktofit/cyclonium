export class CaptureArray<T> {
  capture(): T[] {
    const copy = [...this._array];
    this._array.length = 0;
    return copy;
  }

  push(value: T): void {
    this._array.push(value);
  }

  private _array: T[] = [];
}
