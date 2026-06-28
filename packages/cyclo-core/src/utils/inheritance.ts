/* eslint-disable @typescript-eslint/no-unsafe-function-type */

export function isSubClassOfInclusive<T extends new (...args: never[]) => unknown>(subClass: Function, superClass: T): subClass is T {
  return subClass === superClass || subClass.prototype instanceof superClass;
}
