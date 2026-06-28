/// <meta "uuid"="d716c0b9-0a04-4247-b7a1-21f76bbf0e3b"/>

import { CycloComponent } from '@cyclonium/core/framework';
import { editable, executeInEditMode, cycloClass, serializable } from '@cyclonium/core/legacy-decorator';
import { SortSettings } from './sort-settings.js';

@cycloClass(`cyclo.SortingGroup`)
@executeInEditMode
export class SortingGroup extends CycloComponent {
  @editable
  get sortSettings() {
    return this._sortSettings;
  }

  protected override onDestroy(): void {
    this._sortSettings.disconnect();
  }

  protected override onEnabled(): void {
    this._sortSettings.connect(this);
  }

  protected override onDisabled(): void {
    this._sortSettings.disconnect();
  }

  @serializable
  private _sortSettings = new SortSettings();
}
