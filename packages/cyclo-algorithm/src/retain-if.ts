export function retainIf<T>(array: T[], predicate: (item: T, index: number, array: T[]) => boolean): void {
  const arrayLength = array.length;
  let write = 0;

  for (; write < arrayLength; ++write) {
    if (!predicate(array[write], write, array)) {
      break;
    }
  }

  if (write === arrayLength) {
    return;
  }

  for (let read = write + 1; read < arrayLength; ++read) {
    const item = array[read];
    if (predicate(item, read, array)) {
      array[write] = item;
      ++write;
    }
  }

  array.length = write;
}
