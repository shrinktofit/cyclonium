import { partition } from './partition.js';

export function retainIf<T>(array: T[], predicate: (item: T, index: number, array: T[]) => boolean): void {
  const iFalsy = partition(array, predicate);
  array.length = iFalsy;
}
