import type {
  AssetCatalog,
  AssetRecord,
  AssetResourceId,
  CocosUuid,
} from './model.js';
import type { AssetId } from './public.js';
import { AssetMergeMode } from './public.js';

export class CatalogResolver {
  constructor(catalog: AssetCatalog) {
    this.#catalog = catalog;
  }

  resolve(id: AssetId): AssetRecord | undefined {
    const resourceId = this.#catalog.keys.get(id)?.[0];
    return resourceId === undefined
      ? undefined
      : this.#catalog.records.get(resourceId);
  }

  selectResourceIds(
    keys: readonly AssetId[],
    mergeMode: AssetMergeMode,
  ): readonly AssetResourceId[] {
    const locations = keys.map((key) => this.#catalog.keys.get(key) ?? []);
    switch (mergeMode) {
    case AssetMergeMode.useFirst:
      return locations.find((resourceIds) => resourceIds.length > 0) ?? [];
    case AssetMergeMode.union:
      return Array.from(new Set(locations.flat()));
    case AssetMergeMode.intersection: {
      const [first = [], ...rest] = locations;
      return first.filter((resourceId) => rest.every(
        (resourceIds) => resourceIds.includes(resourceId),
      ));
    }
    default:
      throw new TypeError(
        `Unknown Asset merge mode "${String(mergeMode)}".`,
      );
    }
  }

  resolveCocosUuid(uuid: CocosUuid): AssetRecord | undefined {
    const resourceId = this.#catalog.cocosUuids.get(uuid);
    return resourceId === undefined
      ? undefined
      : this.#catalog.records.get(resourceId);
  }

  resolveResource(
    resourceId: AssetResourceId,
  ): AssetRecord | undefined {
    return this.#catalog.records.get(resourceId);
  }

  readonly #catalog: AssetCatalog;
}
