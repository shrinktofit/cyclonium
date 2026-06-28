export function concatDumpPath(path: string, key: string) {
  return path ? `${path}.${key}` : key;
}
