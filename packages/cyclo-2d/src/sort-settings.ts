import { cycloClass, editable, idem, designType, serializable } from '@cyclonium/core/legacy-decorator';
import { CCInteger } from 'cc';
import { MIN_ORDER_IN_LAYER, MAX_ORDER_IN_LAYER, type SortableRenderer, type SortingTreeGroup } from './sortable.js';
import { SortingLayer } from './sorting-layer.js';
import { SortingTreeNode } from './sorting-tree.js';

@cycloClass(`cyclo.SortSettings`)
export class SortSettings {
  @editable
  @idem
  @designType(SortingLayer)
  get sortingLayer() {
    return this._sortingLayer;
  }

  set sortingLayer(value) {
    this._sortingLayer = value;
    this._updateRenderOrder();
  }

  @editable({
    type: CCInteger,
    min: MIN_ORDER_IN_LAYER,
    max: MAX_ORDER_IN_LAYER,
  })
  @idem
  get orderInLayer() {
    return this._orderInLayer;
  }

  set orderInLayer(value) {
    this._orderInLayer = value;
    this._updateRenderOrder();
  }

  get connected() {
    return this._sortingTreeNode !== undefined;
  }

  get sortingKey() {
    return this._sortingTreeNode?.sortingKeyStart ?? 0;
  }

  connect(sortableRenderer: SortableRenderer | SortingTreeGroup) {
    if (this._sortingTreeNode) {
      throw new Error('Already connected to a sorting tree node');
    }
    this._sortingTreeNode = SortingTreeNode.create(sortableRenderer);
  }

  disconnect() {
    this._sortingTreeNode?.destroy();
    this._sortingTreeNode = undefined;
  }

  @serializable
  private _sortingLayer: number = 0;

  @serializable
  private _orderInLayer: number = 0;

  private _sortingTreeNode: SortingTreeNode | undefined = undefined;

  private _updateRenderOrder() {
    if (!this._sortingTreeNode) {
      return;
    }
    this._sortingTreeNode.update();
  }
}
