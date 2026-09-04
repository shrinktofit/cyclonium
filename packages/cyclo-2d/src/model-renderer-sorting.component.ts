/// <meta "uuid"="206dd94f-ea5f-40dc-a75a-9af8a48c9bd2"/>

import { CycloComponent } from '@cyclonium/core/framework';
import { cycloClass, disallowMultiple, editable, executeInEditMode, stored } from '@cyclonium/core/legacy-decorator';
import { ModelRenderer } from 'cc';
import { SortableRenderer } from './sortable.js';
import { SortSettings } from './sort-settings.js';

/**
 * Applies Cyclo sorting keys to the Cocos ModelRenderer components on the same node.
 *
 * Add the target renderers before this component is enabled; runtime additions are not tracked.
 * Only one ModelRendererSorting may be attached to a node, and this component owns the
 * connection lifecycle of its SortSettings.
 * ModelRenderer priority affects transparent render queues only.
 */
@cycloClass('cyclo.ModelRendererSorting')
@disallowMultiple
@executeInEditMode
export class ModelRendererSorting extends CycloComponent implements SortableRenderer {
  @editable
  get sortSettings() {
    return this._sortSettings;
  }

  get [SortableRenderer.Tags.sortSettings]() {
    return this._sortSettings;
  }

  setSortingKey(sortingKey: number): void {
    for (const modelRenderer of this.getComponents(ModelRenderer)) {
      modelRenderer.priority = sortingKey;
    }
  }

  protected override onDestroy(): void {
    super.onDestroy();
    this._sortSettings.disconnect();
  }

  protected override onEnabled(): void {
    this._sortSettings.connect(this);
  }

  protected override onDisabled(): void {
    this._sortSettings.disconnect();
    this.setSortingKey(0);
  }

  @stored
  private _sortSettings = new SortSettings();
}
