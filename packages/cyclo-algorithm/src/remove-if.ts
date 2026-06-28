import { retainIf } from './retain-if.js';

export function removeIf<T>(array: T[], predicate: (item: T, index: number, array: T[]) => boolean): void {
  retainIf(array, (item, index, items) => !predicate(item, index, items));
}
