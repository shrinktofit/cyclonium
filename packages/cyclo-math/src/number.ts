export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

export function approxEqual(a: number, b: number, epsilon: number) {
  return Math.abs(a - b) < epsilon;
}

export function approxEqualExclusive(a: number, b: number, epsilon: number) {
  return Math.abs(a - b) < epsilon;
}

export function approxEqualInclusive(a: number, b: number, epsilon: number) {
  return Math.abs(a - b) <= epsilon;
}

export function towards(current: number, target: number, maxDelta: number) {
  if (Math.abs(target - current) <= maxDelta) {
    return target;
  }
  return current + Math.sign(target - current) * maxDelta;
}

export function randomIntRange(min: number, maxExclusive: number) {
  return Math.floor(Math.random() * (maxExclusive - min)) + min;
}
