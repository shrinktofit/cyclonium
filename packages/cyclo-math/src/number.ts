export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

export function inverseLerp(from: number, to: number, value: number) {
  if (from === to) {
    return 0;
  }
  return (value - from) / (to - from);
}

export function remap(value: number, inputMin: number, inputMax: number, outputMin: number, outputMax: number) {
  return lerp(outputMin, outputMax, inverseLerp(inputMin, inputMax, value));
}

export function wrap(value: number, min: number, max: number) {
  const range = max - min;
  if (range === 0) {
    return Number.NaN;
  }
  return ((((value - min) % range) + range) % range) + min;
}

export function pingPong(value: number, length: number) {
  const positiveLength = Math.abs(length);
  if (positiveLength === 0) {
    return 0;
  }
  return positiveLength - Math.abs(wrap(value, 0, positiveLength * 2) - positiveLength);
}

export function smoothStep(from: number, to: number, value: number) {
  const t = clamp(inverseLerp(from, to, value), 0, 1);
  return t * t * (3 - 2 * t);
}

export function isPowerOfTwo(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    return false;
  }

  let remaining = value;
  while (remaining > 1) {
    if (remaining % 2 !== 0) {
      return false;
    }
    remaining /= 2;
  }

  return true;
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
