import {
  toRaw,
  isRef,
  isReactive,
  isProxy,
} from 'vue';

export function toRawDeep<T>(sourceObj: T): T {
  const toRawRecursive = <T>(input: T): T => {
    if (Array.isArray(input)) {
      return input.map((item) => toRawRecursive(item)) as T;
    } else if (isRef(input) || isReactive(input) || isProxy(input)) {
      return toRawRecursive(toRaw(input));
    } else if (input && typeof input === 'object') {
      return Object.keys(input).reduce((acc, key) => {
        acc[key as keyof typeof acc] = toRawRecursive(input[key as keyof typeof input]);
        return acc;
      }, {} as T);
    }
    return input;
  };
  return toRawRecursive(sourceObj);
}
