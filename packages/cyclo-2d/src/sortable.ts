import { SortingLayers, type Component } from 'cc';
import type { SortSettings } from './sort-settings.js';

export interface SortableRenderer extends Component {
  readonly [SortableRenderer.Tags.sortSettings]: SortSettings;

  setSortingKey(sortingKey: number): void;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace SortableRenderer {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace Tags {
    export const sortSettings = Symbol('isSortableRenderer');
  }

  export function is(component: Component): component is SortableRenderer {
    return Tags.sortSettings in component;
  }
}

export interface SortingTreeGroup extends Component {
  readonly [SortingTreeGroup.Tags.sortSettings]: SortSettings;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace SortingTreeGroup {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace Tags {
    export const sortSettings = Symbol('isSortingTreeGroup');
  }

  export function is(component: Component): component is SortingTreeGroup {
    return Tags.sortSettings in component;
  }
}

const MAX_ORDER_IN_LAYER_POW = 16;
export const MIN_ORDER_IN_LAYER = -(2 ** (MAX_ORDER_IN_LAYER_POW - 1));
export const MAX_ORDER_IN_LAYER = 2 ** (MAX_ORDER_IN_LAYER_POW - 1);

export function computeLocalSortingKey(sortSettings: SortSettings) {
  const sortingLayerIndex = SortingLayers.getLayerIndex(sortSettings.sortingLayer);
  return (sortingLayerIndex << MAX_ORDER_IN_LAYER_POW) + (sortSettings.orderInLayer + MAX_ORDER_IN_LAYER);
}
