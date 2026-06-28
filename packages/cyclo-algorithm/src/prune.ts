import { retainIf } from './retain-if.js';

/**
 * @deprecated Use retainIf instead.
 */
export function prune<T>(array: T[], predicate: (item: T, index: number, array: T[]) => boolean): void {
  retainIf(array, predicate);
}
