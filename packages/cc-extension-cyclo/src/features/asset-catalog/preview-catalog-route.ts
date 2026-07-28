import { join } from 'node:path';
import { pathExists } from 'fs-extra';

const CATALOG_FILE_PATTERN = /^catalog\.[a-f0-9]{64}\.json$/u;

export interface CatalogRouteResponse {
  status(code: number): CatalogRouteResponse;
  send(body: string): void;
  sendFile(file: string): void;
}

export async function servePreviewCatalogFile(
  directory: string,
  fileName: string,
  response: CatalogRouteResponse,
  next: () => void,
): Promise<void> {
  if (!CATALOG_FILE_PATTERN.test(fileName)) {
    response.status(400).send('Invalid Cyclo Asset Catalog revision.');
    return;
  }
  const file = join(directory, fileName);
  if (!await pathExists(file)) {
    next();
    return;
  }
  response.sendFile(file);
}
