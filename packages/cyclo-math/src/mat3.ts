import { approxEqual } from './number.js';
import { Vec2 } from './vec2.js';

export class Mat3 {
  public static ZERO = Object.freeze(new Mat3(
    0, 0, 0, 0, 0, 0, 0, 0, 0,
  ));

  public static IDENTITY = Object.freeze(new Mat3(
    1, 0, 0, 0, 1, 0, 0, 0, 1,
  ));

  static clone(a: Mat3) {
    return new Mat3(
      a.m11, a.m12, a.m13, a.m21, a.m22, a.m23, a.m31, a.m32, a.m33,
    );
  }

  static assign(a: Mat3, b: Mat3) {
    a.m11 = b.m11;
    a.m12 = b.m12;
    a.m13 = b.m13;
    a.m21 = b.m21;
    a.m22 = b.m22;
    a.m23 = b.m23;
    a.m31 = b.m31;
    a.m32 = b.m32;
    a.m33 = b.m33;
  }

  static transpose(a: Mat3) {
    return this.clone(a).transportSelf();
  }

  static mul(...mats: readonly Mat3[]) {
    const nMats = mats.length;
    if (nMats === 0) {
      return this.clone(Mat3.IDENTITY);
    }
    const result = this.clone(mats[nMats - 1]);
    for (let i = nMats - 2; i >= 0; i--) {
      mat3Mul(mats[i], result, result);
    }
    return result;
  }

  constructor(other: Mat3);

  constructor(
    m11: number, m12: number, m13: number,
    m21: number, m22: number, m23: number,
    m31: number, m32: number, m33: number,
  );

  constructor(...args: [Mat3] | [
    m11: number, m12: number, m13: number,
    m21: number, m22: number, m23: number,
    m31: number, m32: number, m33: number,
  ]) {
    if (args.length === 1) {
      Mat3.assign(this, args[0]);
    } else {
      this.set(...args);
    }
  }

  m11 = 0;
  m12 = 0;
  m13 = 0;
  m21 = 0;
  m22 = 0;
  m23 = 0;
  m31 = 0;
  m32 = 0;
  m33 = 0;

  set(
    m11: number, m12: number, m13: number,
    m21: number, m22: number, m23: number,
    m31: number, m32: number, m33: number,
  ) {
    this.m11 = m11;
    this.m12 = m12;
    this.m13 = m13;
    this.m21 = m21;
    this.m22 = m22;
    this.m23 = m23;
    this.m31 = m31;
    this.m32 = m32;
    this.m33 = m33;
    return this;
  }

  determinant() {
    const {
      m11, m12, m13,
      m21, m22, m23,
      m31, m32, m33,
    } = this;
    return m11 * (m22 * m33 - m23 * m32)
      - m12 * (m21 * m33 - m23 * m31)
      + m13 * (m21 * m32 - m22 * m31);
  }

  inverseSelf() {
    const det = this.determinant();
    if (det === 0) {
      return this.set(
        0, 0, 0, 0, 0, 0, 0, 0, 0,
      );
    }
    const invDet = 1.0 / det;
    const {
      m11, m12, m13,
      m21, m22, m23,
      m31, m32, m33,
    } = this;
    return this.set(
      (m22 * m33 - m23 * m32) * invDet, (m13 * m32 - m12 * m33) * invDet, (m12 * m23 - m13 * m22) * invDet, (m23 * m31 - m21 * m33) * invDet, (m11 * m33 - m13 * m31) * invDet, (m13 * m21 - m11 * m23) * invDet, (m21 * m32 - m22 * m31) * invDet, (m12 * m31 - m11 * m32) * invDet, (m11 * m22 - m12 * m21) * invDet,
    );
  }

  inverse() {
    return Mat3.clone(this).inverseSelf();
  }

  transportSelf() {
    const { m11, m12, m13, m21, m22, m23, m31, m32, m33 } = this;
    return this.set(
      m11, m21, m31, m12, m22, m32, m13, m23, m33,
    );
  }

  transport() {
    return Mat3.clone(this).transportSelf();
  }

  transformVec2(v: Vec2, out?: Vec2) {
    out ??= new Vec2();
    const { m11, m12, m13, m21, m22, m23 } = this;
    const { x, y } = v;
    return Vec2.set(out,
      m11 * x + m12 * y + m13,
      m21 * x + m22 * y + m23,
    );
  }

  transformVec2Normal(v: Vec2, out?: Vec2) {
    out ??= new Vec2();
    const { m11, m12, m21, m22 } = this;
    const delta = m11 * m22 - m12 * m21;
    if (approxEqual(delta, 0, 1e-8)) {
      return Vec2.set(out, 0, 0);
    }
    const { x, y } = v;
    return Vec2.set(out,
      (m22 * x - m12 * y) / delta,
      (-m21 * x + m11 * y) / delta,
    );
  }
}

function mat3Mul(a: Mat3, b: Mat3, out: Mat3) {
  const {
    m11: a11, m12: a12, m13: a13,
    m21: a21, m22: a22, m23: a23,
    m31: a31, m32: a32, m33: a33,
  } = a;
  const {
    m11: b11, m12: b12, m13: b13,
    m21: b21, m22: b22, m23: b23,
    m31: b31, m32: b32, m33: b33,
  } = b;
  return out.set(
    a11 * b11 + a12 * b21 + a13 * b31, a11 * b12 + a12 * b22 + a13 * b32, a11 * b13 + a12 * b23 + a13 * b33, a21 * b11 + a22 * b21 + a23 * b31, a21 * b12 + a22 * b22 + a23 * b32, a21 * b13 + a22 * b23 + a23 * b33, a31 * b11 + a32 * b21 + a33 * b31, a31 * b12 + a32 * b22 + a33 * b32, a31 * b13 + a32 * b23 + a33 * b33,
  );
}
