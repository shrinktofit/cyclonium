import { join } from 'node:path';
import {
  servePreviewCatalogFile,
  type CatalogRouteResponse,
} from '../../features/asset-catalog/preview-catalog-route.js';

interface CatalogServerRequest {
  readonly params: Record<number, string>;
}

const PREVIEW_CATALOG_DIRECTORY = join(
  Editor.Project.tmpDir,
  'cyclo-asset-pipeline',
  'catalog',
);
export const get = [{
  url: /^\/cyclo-asset-pipeline\/catalog\/(catalog\.[a-f0-9]{64}\.json)$/u,
  async handle(
    request: CatalogServerRequest,
    response: CatalogRouteResponse,
    next: () => void,
  ): Promise<void> {
    await servePreviewCatalogFile(
      PREVIEW_CATALOG_DIRECTORY,
      request.params[0],
      response,
      next,
    );
  },
}];
