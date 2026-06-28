import { Vec2 } from './vec2.js';

export class Bounds2D {
  static fromMinMax(min: Vec2, max: Vec2) {
    return new Bounds2D(min, max);
  }

  static fromCenterSize(center: Vec2, size: Vec2) {
    return new Bounds2D(Vec2.ZERO, Vec2.ZERO).setCenterSize(center, size);
  }

  constructor();
  constructor(min: Vec2, max: Vec2);
  constructor(min?: Vec2, max?: Vec2) {
    if (min && max) {
      this._min.copyFrom(min);
      this._max.copyFrom(max);
    }
  }

  get min() {
    return this._min;
  }

  set min(value) {
    this._min.copyFrom(value);
  }

  get xMin() {
    return this._min.x;
  }

  set xMin(value) {
    this._min.x = value;
  }

  get yMin() {
    return this._min.y;
  }

  set yMin(value) {
    this._min.y = value;
  }

  get max() {
    return this._max;
  }

  set max(value) {
    this._max.copyFrom(value);
  }

  get xMax() {
    return this._max.x;
  }

  set xMax(value) {
    this._max.x = value;
  }

  get yMax() {
    return this._max.y;
  }

  set yMax(value) {
    this._max.y = value;
  }

  get center() {
    return (this._center_cache ??= new Vec2()).copyFrom(this._min).addSelf(this._max).mulSelfScalar(0.5);
  }

  set center(value) {
    const { _min: { x: xMin, y: yMin }, _max: { x: xMax, y: yMax } } = this;
    const sizeX = (xMax - xMin) * 0.5;
    const sizeY = (yMax - yMin) * 0.5;
    this._min.set(value.x - sizeX, value.y - sizeY);
    this._max.set(value.x + sizeX, value.y + sizeY);
  }

  get x() {
    const { _min: { x: xMin }, _max: { x: xMax } } = this;
    return (xMax + xMin) * 0.5;
  }

  set x(value) {
    const { _min: { x: xMin }, _max: { x: xMax } } = this;
    const sizeX = (xMax - xMin) * 0.5;
    this._min.x = value - sizeX;
    this._max.x = value + sizeX;
  }

  get y() {
    const { _min: { y: yMin }, _max: { y: yMax } } = this;
    return (yMax + yMin) * 0.5;
  }

  set y(value) {
    const { _min: { y: yMin }, _max: { y: yMax } } = this;
    const sizeY = (yMax - yMin) * 0.5;
    this._min.y = value - sizeY;
    this._max.y = value + sizeY;
  }

  get size() {
    return (this._size_cache ??= new Vec2()).copyFrom(this._max).subSelf(this._min);
  }

  set size(value) {
    const { _min: { x: xMin, y: yMin }, _max: { x: xMax, y: yMax } } = this;
    const centerX = (xMax + xMin) * 0.5;
    const centerY = (yMax + yMin) * 0.5;
    this._min.set(centerX - value.x * 0.5, centerY - value.y * 0.5);
    this._max.set(centerX + value.x * 0.5, centerY + value.y * 0.5);
  }

  get width() {
    const { _min: { x: xMin }, _max: { x: xMax } } = this;
    return xMax - xMin;
  }

  set width(value) {
    const { _min: { x: xMin }, _max: { x: xMax } } = this;
    const sizeX = (xMax - xMin) * 0.5;
    this._min.x = value - sizeX;
    this._max.x = value + sizeX;
  }

  get height() {
    const { _min: { y: yMin }, _max: { y: yMax } } = this;
    return yMax - yMin;
  }

  set height(value) {
    const { _min: { y: yMin }, _max: { y: yMax } } = this;
    const sizeY = (yMax - yMin) * 0.5;
    this._min.y = value - sizeY;
    this._max.y = value + sizeY;
  }

  contains(point: Vec2): boolean;
  contains(x: number, y: number): boolean;
  contains(other: Bounds2D): boolean;
  contains(_x: number | Vec2 | Bounds2D, _y?: number) {
    const { _min: { x: xMin, y: yMin }, _max: { x: xMax, y: yMax } } = this;
    if (typeof _x === 'number') {
      const x = _x;
      const y = _y as number;
      return xMin <= x && x <= xMax && yMin <= y && y <= yMax;
    } else if (_x instanceof Bounds2D) {
      const { _min: { x: otherXMin, y: otherYMin }, _max: { x: otherXMax, y: otherYMax } } = _x;
      return xMin <= otherXMin && otherXMax <= xMax && yMin <= otherYMin && otherYMax <= yMax;
    } else {
      const { x, y } = _x;
      return xMin <= x && x <= xMax && yMin <= y && y <= yMax;
    }
  }

  intersects(other: Bounds2D): boolean {
    const { _min: { x: xMin, y: yMin }, _max: { x: xMax, y: yMax } } = this;
    const { _min: { x: otherXMin, y: otherYMin }, _max: { x: otherXMax, y: otherYMax } } = other;
    return xMin <= otherXMax && otherXMin <= xMax && yMin <= otherYMax && otherYMin <= yMax;
  }

  setMinMax(min: Vec2, max: Vec2) {
    this._min.copyFrom(min);
    this._max.copyFrom(max);
    return this;
  }

  setCenterSize(center: Vec2, size: Vec2) {
    const hx = size.x * 0.5;
    const hy = size.y * 0.5;
    this._min.copyFrom(center);
    this._min.x -= hx;
    this._min.y -= hy;
    this._max.copyFrom(center);
    this._max.x += hx;
    this._max.y += hy;
    return this;
  }

  extend(point: Vec2) {
    const { x, y } = point;
    const min = this._min;
    const max = this._max;
    min.set(Math.min(min.x, x), Math.min(min.y, y));
    max.set(Math.max(max.x, x), Math.max(max.y, y));
    return this;
  }

  private readonly _min = new Vec2();
  private readonly _max = new Vec2();
  private _center_cache: undefined | Vec2 = undefined;
  private _size_cache: undefined | Vec2 = undefined;
}
