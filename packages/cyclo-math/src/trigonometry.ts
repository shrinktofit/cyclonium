import { clamp, towards } from './number.js';

const PI2 = Math.PI * 2;

export function to0ToPI2(rad: number) {
  let normalized = rad % PI2;
  if (normalized < 0) {
    normalized += PI2;
  }
  return normalized;
}

export function toDegrees(rad: number) {
  return (rad * 180) / Math.PI;
}

export function toRadians(degree: number) {
  return (degree * Math.PI) / 180;
}

export function lerpAngle(from: number, to: number, t: number) {
  let delta = to0ToPI2(to - from);
  if (delta > Math.PI) {
    delta -= PI2;
  }
  return from + delta * clamp(t, 0, 1);
}

export function deltaAngle(from: number, to: number) {
  let delta = to0ToPI2(to - from);
  if (delta > Math.PI) {
    delta -= PI2;
  }
  return delta;
}

export function towardsAngle(current: number, target: number, maxDelta: number) {
  const delta = deltaAngle(current, target);
  if (-maxDelta < delta && delta < maxDelta) {
    return target;
  }
  target = current + delta;
  return towards(current, target, maxDelta);
}
