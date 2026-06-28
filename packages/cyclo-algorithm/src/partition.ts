export function partition<T>(array: T[], predict: (item: T, index: number, array: T[]) => boolean) {
  const arrayLength = array.length;
  let iFalsy = 0;
  for (; iFalsy < arrayLength; iFalsy++) {
    if (!predict(array[iFalsy], iFalsy, array)) {
      break;
    }
  }
  if (iFalsy === arrayLength) {
    return iFalsy;
  }
  for (let i = iFalsy + 1; i < arrayLength; ++i) {
    const item = array[i];
    if (predict(item, i, array)) {
      const t = array[iFalsy];
      array[iFalsy] = item;
      array[i] = t;
      ++iFalsy;
    }
  }
  return iFalsy;
}
