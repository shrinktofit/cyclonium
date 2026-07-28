const FORMAT_BY_MEDIA_TYPE = new Map<string, string>([
  ['application/json', 'json'],
  ['text/json', 'json'],
  ['text/plain', 'text'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpeg'],
  ['image/webp', 'webp'],
  ['audio/mpeg', 'mp3'],
  ['audio/mp3', 'mp3'],
]);

const KNOWN_REMOTE_FORMATS = new Set([
  'text',
  'txt',
  'json',
  'png',
  'jpeg',
  'webp',
  'mp3',
]);

export function formatFromRemoteRequest(
  explicitFormat: string | undefined,
  url: string,
): string {
  return explicitFormat === undefined || explicitFormat.length === 0
    ? formatFromUrl(url) ?? ''
    : normalizeRemoteFormat(explicitFormat);
}

export function resolveRemoteFormat(
  explicitFormat: string | undefined,
  url: string,
  contentType: string | undefined,
): string {
  if (explicitFormat !== undefined && explicitFormat.length > 0) {
    return normalizeRemoteFormat(explicitFormat);
  }

  const urlFormat = formatFromUrl(url);
  if (urlFormat !== undefined) {
    return urlFormat;
  }

  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  const contentTypeFormat = mediaType === undefined
    ? undefined
    : FORMAT_BY_MEDIA_TYPE.get(mediaType);
  if (contentTypeFormat !== undefined) {
    return contentTypeFormat;
  }

  throw new Error(
    `The remote asset format for "${url}" could not be inferred. `
    + 'Specify RemoteAssetLoadOptions.format.',
  );
}

export function assertRemoteFormatSupported(
  format: string,
  supportedFormats: ReadonlySet<string>,
  assetDescription: string,
): void {
  if (!supportedFormats.has(format)) {
    throw new Error(
      `Remote format "${format}" is not supported for `
      + `${assetDescription} assets.`,
    );
  }
}

export function normalizeRemoteFormat(format: string): string {
  const normalized = format.startsWith('.')
    ? format.slice(1).toLowerCase()
    : format.toLowerCase();
  return normalized === 'jpg' ? 'jpeg' : normalized;
}

function formatFromUrl(url: string): string | undefined {
  const withoutFragment = url.split('#', 1)[0] ?? '';
  const withoutQuery = withoutFragment.split('?', 1)[0] ?? '';
  const lastSlash = withoutQuery.lastIndexOf('/');
  const lastDot = withoutQuery.lastIndexOf('.');
  if (lastDot <= lastSlash) {
    return undefined;
  }
  const format = normalizeRemoteFormat(withoutQuery.slice(lastDot + 1));
  return KNOWN_REMOTE_FORMATS.has(format) ? format : undefined;
}
