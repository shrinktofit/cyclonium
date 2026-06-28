import { clamp, lerp } from './number.js';

const EPSILON = 1e-6;

export class Vec2 {
  static ZERO = Object.freeze(new Vec2());

  static ONE = Object.freeze(new Vec2(1, 1));

  static UNIT_X = Object.freeze(new Vec2(1, 0));

  static UNIT_Y = Object.freeze(new Vec2(0, 1));

  static POSITIVE_INFINITY = Object.freeze(new Vec2(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY));

  static NEGATIVE_INFINITY = Object.freeze(new Vec2(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY));

  static splat(x: number) {
    return new Vec2(x, x);
  }

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  get magnitude() {
    return Math.sqrt(this.magnitudeSquared);
  }

  get magnitudeSquared() {
    return this.x * this.x + this.y * this.y;
  }

  static clone(a: Vec2) {
    return new Vec2(a.x, a.y);
  }

  static fromLiteral(v: { x: number; y: number }) {
    return new Vec2(v.x, v.y);
  }

  static set(a: Vec2, x: number, y: number) {
    a.x = x;
    a.y = y;
    return a;
  }

  static assign(a: Vec2, b: Vec2) {
    a.x = b.x;
    a.y = b.y;
    return a;
  }

  static strictEquals(a: Vec2, b: Vec2) {
    return a.x === b.x && a.y === b.y;
  }

  static equals(a: Vec2, b: Vec2, epsilon = EPSILON) {
    return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;
  }

  static negate(a: Vec2) {
    return new Vec2(-a.x, -a.y);
  }

  static add(a: Vec2, b: Vec2) {
    return new Vec2(a.x + b.x, a.y + b.y);
  }

  static sub(a: Vec2, b: Vec2) {
    return new Vec2(a.x - b.x, a.y - b.y);
  }

  static mul(a: Vec2, b: Vec2) {
    return new Vec2(a.x * b.x, a.y * b.y);
  }

  static div(a: Vec2, b: Vec2) {
    return new Vec2(a.x / b.x, a.y / b.y);
  }

  static mulScalar(a: Vec2, b: number) {
    return new Vec2(a.x * b, a.y * b);
  }

  static divScalar(a: Vec2, b: number) {
    return new Vec2(a.x / b, a.y / b);
  }

  static normalize(a: Vec2) {
    return Vec2.divScalar(a, a.magnitude);
  }

  static dot(a: Vec2, b: Vec2) {
    return a.x * b.x + a.y * b.y;
  }

  static cross(a: Vec2, b: Vec2) {
    return a.x * b.y - a.y * b.x;
  }

  static distance(a: Vec2, b: Vec2) {
    return Math.sqrt(Vec2.squaredDistance(a, b));
  }

  static squaredDistance(a: Vec2, b: Vec2) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  static angle(a: Vec2, b: Vec2) {
    const magSqr1 = a.magnitudeSquared;
    const magSqr2 = b.magnitudeSquared;
    if (magSqr1 === 0 || magSqr2 === 0) {
      return 0.0;
    }
    const dot = Vec2.dot(a, b);
    let cosine = dot / (Math.sqrt(magSqr1 * magSqr2));
    cosine = clamp(cosine, -1.0, 1.0);
    return Math.acos(cosine);
  }

  static signedAngle(a: Vec2, b: Vec2) {
    return Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x);
  }

  static min(a: Vec2, b: Vec2) {
    return new Vec2(Math.min(a.x, b.x), Math.min(a.y, b.y));
  }

  static max(a: Vec2, b: Vec2) {
    return new Vec2(Math.max(a.x, b.x), Math.max(a.y, b.y));
  }

  static clamp(v: Vec2, min: Vec2, max: Vec2) {
    return new Vec2(
      Math.min(Math.max(v.x, min.x), max.x),
      Math.min(Math.max(v.y, min.y), max.y),
    );
  }

  static lerp(a: Vec2, b: Vec2, t: number) {
    return new Vec2(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
  }

  static rotate(a: Vec2, angle: number) {
    return a.clone().rotateSelf(angle);
  }

  x = 0;

  y = 0;

  toString() {
    return `Vec2(${this.x}, ${this.y})`;
  }

  toFixed(fractionDigits?: number) {
    return `Vec2(${this.x.toFixed(fractionDigits)}, ${this.y.toFixed(fractionDigits)})`;
  }

  toPrecision(precision: number) {
    return `Vec2(${this.x.toPrecision(precision)}, ${this.y.toPrecision(precision)})`;
  }

  clone() {
    return Vec2.clone(this);
  }

  set(x: number, y: number) {
    return Vec2.set(this, x, y);
  }

  copyFrom(other: Vec2) {
    return Vec2.assign(this, other);
  }

  negation() {
    return Vec2.negate(this);
  }

  normalize() {
    return this.clone().normalizeSelf();
  }

  normalizeSelf() {
    const mag = this.magnitude;
    if (mag < EPSILON) {
      this.x = 0;
      this.y = 0;
    } else {
      this.x /= mag;
      this.y /= mag;
    }
    return this;
  }

  orthonormal() {
    const mag = this.magnitude;
    if (mag < EPSILON) {
      return new Vec2(0, 0);
    }
    return new Vec2(-this.y / mag, this.x / mag);
  }

  reverseOrthonormal() {
    const mag = this.magnitude;
    if (mag < EPSILON) {
      return new Vec2(0, 0);
    }
    return new Vec2(this.y / mag, -this.x / mag);
  }

  addSelf(other: Vec2) {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  add(other: Vec2) {
    return this.clone().addSelf(other);
  }

  subSelf(other: Vec2) {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  sub(other: Vec2) {
    return this.clone().subSelf(other);
  }

  mulSelf(other: Vec2) {
    this.x *= other.x;
    this.y *= other.y;
    return this;
  }

  mul(other: Vec2) {
    return this.clone().mulSelf(other);
  }

  mulSelfScalar(scalar: number) {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  mulScalar(scalar: number) {
    return this.clone().mulSelfScalar(scalar);
  }

  addMulScalar(other: Vec2, scalar: number) {
    return this.clone().addMulScalarSelf(other, scalar);
  }

  addMulScalarSelf(other: Vec2, scalar: number) {
    this.x += other.x * scalar;
    this.y += other.y * scalar;
    return this;
  }

  projectSelf(other: Vec2) {
    const scalar = Vec2.dot(this, other) / Vec2.dot(other, other);
    this.x = other.x * scalar;
    this.y = other.y * scalar;
    return this;
  }

  project(other: Vec2) {
    return this.clone().projectSelf(other);
  }

  rotate(angle: number) {
    return this.clone().rotateSelf(angle);
  }

  rotateSelf(angle: number) {
    const x = this.x;
    const y = this.y;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    this.x = cos * x - sin * y;
    this.y = sin * x + cos * y;
    return this;
  }

  atan2() {
    return Math.atan2(this.y, this.x);
  }
}

export function v2(x = 0, y = 0) {
  return new Vec2(x, y);
}
