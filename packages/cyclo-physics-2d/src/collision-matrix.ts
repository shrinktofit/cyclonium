import { editable, serializable } from '@cyclonium/core/legacy-decorator';
import { cycloBuiltinClass } from '@cyclonium/core/internal';
import { dumpRaw } from '@cyclonium/core/utils';

const EXTENT = 16;

@cycloBuiltinClass('CollisionMatrix')
export class CollisionMatrix {
  static readonly EXTENT = EXTENT;

  @editable
  @dumpRaw
  private get values() {
    return this._values;
  }

  private set values(values) {
    this._values = [...values];
  }

  clone() {
    const clone = new CollisionMatrix();
    clone._values = this._values.slice();
    return clone;
  }

  get(i: number, j: number): boolean {
    return this._values[this._locate(i, j)];
  }

  set(i: number, j: number, value: boolean) {
    const index = this._locate(i, j);
    this._values[index] = value;
  }

  getCollisionsBitsOf(i: number): number {
    let bits = 0;
    for (let j = 0; j < EXTENT; j++) {
      const value = this.get(i, j);
      if (value) {
        bits |= 1 << j;
      }
    }
    const rowStart = i * (i + 1) / 2;
    for (let j = 0; j <= i; j++) {
      bits |= this._values[rowStart + j] ? 1 << j : 0;
    }
    return bits;
  }

  @serializable
  private _values: boolean[] = new Array<boolean>(EXTENT * (EXTENT + 1) / 2).fill(false);

  private _locate(i: number, j: number) {
    if (i < 0 || i >= EXTENT || j < 0 || j >= EXTENT) {
      throw new Error(`Index out of range.`);
    }
    if (i > j) {
      [i, j] = [j, i];
    }
    const rowStart = i * (2 * EXTENT - i - 1) / 2;
    return rowStart + j;
  }
}
