import { Mat3 } from './mat3.js';
import { approxEqualInclusive } from './number.js';
import { Vec2 } from './vec2.js';

export function mat3FromSRT(translation: Vec2, rotation: number, scale: Vec2, out?: Mat3) {
  out ??= new Mat3(Mat3.ZERO);
  const { x: tx, y: ty } = translation;
  const { x: sx, y: sy } = scale;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  out.set(
    sx * cos, -sy * sin, tx, sx * sin, sy * cos, ty, 0, 0, 1,
  );
  return out;
}

export function mat3FromTranslation(translation: Vec2, out?: Mat3) {
  out ??= new Mat3(Mat3.ZERO);
  out.set(
    1, 0, translation.x, 0, 1, translation.y, 0, 0, 1,
  );
  return out;
}

export function mat3FromScale(scale: Vec2, out?: Mat3) {
  out ??= new Mat3(Mat3.ZERO);
  out.set(
    scale.x, 0, 0, 0, scale.y, 0, 0, 0, 1,
  );
  return out;
}

export function mat3FromRotation(rotation: number, out?: Mat3) {
  out ??= new Mat3(Mat3.ZERO);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  out.set(
    cos, -sin, 0, sin, cos, 0, 0, 0, 1,
  );
  return out;
}

export function decomposeSRTMat3(mat3: Mat3) {
  /// SRT = T * R * S
  ///     = [sx*cos(r)  -sy*sin(r)   tx]
  ///       [sx*sin(r)   sy*cos(r)   ty]
  ///       [0          0            1 ]
  const {
    m11: m11, m12: m12, m13: tx,
    m21: m21, m22: m22, m23: ty,
    m31: _m31, m32: _32, m33: _m33,
  } = mat3;

  const r = Math.atan2(m21, m11);
  const sx = Math.sqrt(m11 ** 2 + m21 ** 2);
  const sy = Math.sqrt(m12 ** 2 + m22 ** 2);

  let ssx = 0;
  let ssy = 0;
  const signCos = signOfCos(r, 1e-16);
  if (signCos !== 0) {
    ssx = Math.sign(m11) / signCos;
    ssy = Math.sign(m22) / signCos;
  } else {
    const signSin = signOfSin(r, 1e-16);
    ssx = m21 / -signSin;
    ssy = m12 / signSin;
  }

  return {
    translation: new Vec2(tx, ty),
    scale: new Vec2(sx * ssx, sy * ssy),
    rotation: r,
  };
}

const { PI } = Math;
const HALF_PI = PI / 2;

function signOfSin(angle: number, epsilon: number) {
  // assert(angle >= -PI && angle <= PI);
  const p0 = -PI; // 0
  const p1 = 0;
  const p2 = PI; // 0
  switch (true) {
  // -pi
  case approxEqualInclusive(angle, p0, epsilon): return 0;
  // (-pi, 0)
  case angle > p0 + epsilon && angle < p1 - epsilon: return -1;
  // 0
  case approxEqualInclusive(angle, p1, epsilon): return 0;
  // (0, pi)
  case angle > p1 + epsilon && angle < p2 - epsilon: return 1;
  // pi
  case approxEqualInclusive(angle, p2, epsilon): return 0;
  default:
    return 0;
  }
}

function signOfCos(angle: number, epsilon: number) {
  // assert(angle >= -PI && angle <= PI);
  const p0 = -PI;
  const p1 = -HALF_PI; // 0
  const p2 = HALF_PI; // 0
  const p3 = PI;
  switch (true) {
  // (-pi, -pi/2)
  case angle >= p0 && angle < p1 - epsilon: return -1;
  // -pi/2
  case approxEqualInclusive(angle, p1, epsilon): return 0;
  // (-pi/2, 2/pi)
  case angle >= p1 + epsilon && angle < p2 - epsilon: return 1;
  // 2/pi
  case approxEqualInclusive(angle, p2, epsilon): return 0;
  // (2/pi, pi)
  case angle > p2 + epsilon && angle <= p3: return -1;
  default:
    return 0;
  }
}
