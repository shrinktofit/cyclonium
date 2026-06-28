import { Node, Scene } from 'cc';
import { SortingGroup } from './sorting-group.component.js';
import { assert } from '@cyclonium/core/utils';
import { logger } from '@cyclonium/core/log';
import { EDITOR_NOT_IN_PREVIEW } from 'cc/env';
import { computeLocalSortingKey, SortableRenderer } from './sortable.js';
import type { SortSettings } from './sort-settings.js';

const ENABLE_SORTING_TREE_DEBUG: boolean = (false as boolean) && !EDITOR_NOT_IN_PREVIEW;

const debugLog = ENABLE_SORTING_TREE_DEBUG
  ? (() => {
    let indent = 0;
    return {
      incIndent() {
        indent++;
      },

      decIndent() {
        indent--;
      },

      log: (head: unknown, ...args: unknown[]) => {
        const tag = '[SortingTree]';
        if (typeof head === 'string') {
          logger.info(`${tag} ${'  '.repeat(indent)}${head}`, ...args);
        } else {
          logger.info(tag, ...args);
        }
      },
    };
  })()
  : undefined;

interface SceneSortingRecord {
  rootTreeNode: SortingTreeNode;
  treeNodeMap: TreeNodeMap;
  treeChangeContext: {
    readonly dirtyTreeNodes: SortingTreeNode[];
    rootNodeInvolved: boolean;
  };
}

type TreeNodeMap = WeakMap<SortingGroup | SortableRenderer, SortingTreeNode>;

export class SortingTreeNode {
  static create(component: SortingGroup | SortableRenderer) {
    if (ENABLE_SORTING_TREE_DEBUG) {
      debugLog?.log(`Request creating sorting tree node: ${component.name}`);
    }

    const sceneSortingRecord = this._ensureSceneSortingRecord(component);
    const sortingTreeNode = this._getOrCreateNode(sceneSortingRecord, component);

    let nodeToUpdate: SortingTreeNode | undefined;
    const {
      rootTreeNode,
      treeChangeContext: {
        dirtyTreeNodes,
        rootNodeInvolved,
      },
    } = sceneSortingRecord;
    if (rootNodeInvolved) {
      nodeToUpdate = rootTreeNode;
    } else if (dirtyTreeNodes.length === 0) {
      nodeToUpdate = undefined;
      if (ENABLE_SORTING_TREE_DEBUG) {
        debugLog?.log(`No dirty tree nodes, not updating any node`);
      }
    } else {
      const lca = this._computeLCAs(sceneSortingRecord.rootTreeNode, dirtyTreeNodes);
      nodeToUpdate = lca;
    }
    nodeToUpdate?._updateAll();

    return sortingTreeNode;
  }

  get sortingKeyStart() {
    return this._sortingKeyStart;
  }

  destroy() {
    const parent = this._parent;
    assert(parent);
    if (this._component) {
      this._treeNodeMap?.delete(this._component);
    }
    parent._removeChildSlightly(this);
    const children = this._children;
    this._children = [];
    parent._transferChildren(children);
    parent._updateAll();
  }

  update() {
    this._parent?._updateChild(this);
    if (ENABLE_SORTING_TREE_DEBUG) {
      let root: SortingTreeNode;
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      for (let node: SortingTreeNode = this; ;) {
        if (!node._parent) {
          root = node;
          break;
        } else {
          node = node._parent;
        }
      }
      SortingTreeNode._printSortingTree?.(root);
    }
  }

  private static _sceneSortingRecordMap = new WeakMap<Scene, SceneSortingRecord>();

  private static _printSortingTree = (() => {
    if (!ENABLE_SORTING_TREE_DEBUG) {
      return undefined;
    }

    return (root: SortingTreeNode) => {
      let output = '== Sorting Tree ==\n';
      function print(node: SortingTreeNode, depth = 0) {
        const sortingRange = node._sortingKeyEnd - node._sortingKeyStart === 1
          ? `${node._sortingKeyStart}`
          : `${node._sortingKeyStart}-${node._sortingKeyEnd}`;
        output += `${' '.repeat(depth)}[${sortingRange}]${node._component?.name ?? '<root>'}`;
        if (node._sortSettings) {
          const sortSettings = node._sortSettings;
          output += ` (SortingLayer: ${sortSettings.sortingLayer}, OrderInLayer: ${sortSettings.orderInLayer})`;
        }
        output += `\n`;
        node._children.forEach((child) => print(child, depth + 1));
      }
      print(root);
      debugLog?.log(output);
    };
  })();

  private static _computeLCAs(root: SortingTreeNode, nodes: SortingTreeNode[]) {
    assert(nodes.length > 0);

    if (nodes.length === 1) {
      return nodes[0];
    }

    const lca = nodes[0];
    for (let i = 1; i < nodes.length; i++) {
      const which = this._computeLCA(lca, nodes[i]);
      if (!which) {
        return root;
      }
    }
    return lca;
  }

  private static _computeLCA(a: SortingTreeNode, b: SortingTreeNode): SortingTreeNode | undefined {
    // 实现很垃圾，需要优化
    const ancestors = new Set<SortingTreeNode>();
    for (let current: SortingTreeNode | undefined = a; current; current = current._parent) {
      ancestors.add(current);
    }
    for (let current: SortingTreeNode | undefined = b; current; current = current._parent) {
      if (ancestors.has(current)) {
        return current;
      }
    }
    return undefined;
  }

  private static _computeLocalSortingKey(sortingNode: SortingTreeNode) {
    assert(sortingNode._sortSettings);
    return computeLocalSortingKey(sortingNode._sortSettings);
  }

  private static _compareLocalSortingKey(a: SortingTreeNode, b: SortingTreeNode) {
    return this._computeLocalSortingKey(a) - this._computeLocalSortingKey(b);
  }

  private static _ensureSceneSortingRecord(component: SortingGroup | SortableRenderer) {
    const scene = component.node.scene;
    let sceneSortingRecord = this._sceneSortingRecordMap.get(scene);
    if (sceneSortingRecord) {
      sceneSortingRecord.treeChangeContext.rootNodeInvolved = false;
      sceneSortingRecord.treeChangeContext.dirtyTreeNodes.length = 0;
    } else {
      const treeNodeMap = new WeakMap<SortingGroup | SortableRenderer, SortingTreeNode>();
      if (ENABLE_SORTING_TREE_DEBUG) {
        debugLog?.log(`Create(PASSIVE) sorting tree root`);
      }
      const rootTreeNode = new SortingTreeNode(undefined, undefined);
      sceneSortingRecord = {
        rootTreeNode,
        treeNodeMap,
        treeChangeContext: {
          dirtyTreeNodes: [],
          rootNodeInvolved: true,
        },
      };
      this._sceneSortingRecordMap.set(scene, sceneSortingRecord);
      if (ENABLE_SORTING_TREE_DEBUG) {
        debugLog?.log(`[NOTICE] Creating subtrees from <root> top-to-bottom`);
      }
      debugLog?.incIndent();
      this._constructSubTree(sceneSortingRecord, rootTreeNode, scene);
      debugLog?.decIndent();
      if (ENABLE_SORTING_TREE_DEBUG) {
        Object.defineProperty(globalThis, '__printSortingTree__', {
          value: this._printSortingTree?.bind(this, rootTreeNode),
          writable: true,
          configurable: true,
        });
      }
    }
    return sceneSortingRecord;
  }

  private static _getOrCreateParent(sceneSortingRecord: SceneSortingRecord, component: SortingGroup | SortableRenderer) {
    const startSceneNode = component instanceof SortingGroup ? component.node.parent : component.node;
    for (let currentNode: Node | null = startSceneNode; currentNode; currentNode = currentNode.parent) {
      const sortingGroup = currentNode.getComponent(SortingGroup);
      if (sortingGroup && sortingGroup.enabledInHierarchy) {
        const sortingTreeNode = this._getOrCreateNode(sceneSortingRecord, sortingGroup);
        return sortingTreeNode;
      }
    }
    return sceneSortingRecord.rootTreeNode;
  }

  private static _getOrCreateNode(sceneSortingRecord: SceneSortingRecord, component: SortingGroup | SortableRenderer) {
    {
      const existingTreeNode = sceneSortingRecord.treeNodeMap.get(component);
      if (existingTreeNode) {
        return existingTreeNode;
      }
    }

    debugLog?.incIndent();
    const parentTreeNode = this._getOrCreateParent(sceneSortingRecord, component);
    debugLog?.decIndent();
    {
      const existingTreeNode = sceneSortingRecord.treeNodeMap.get(component);
      if (existingTreeNode) {
        return existingTreeNode;
      }
    }

    if (ENABLE_SORTING_TREE_DEBUG) {
      debugLog?.log(`[DYNAMIC] Create sorting tree node for ${component.name}`);
    }
    const newSortingTreeNode = this._createComponentSortingTreeNode(sceneSortingRecord, component);
    parentTreeNode._addChildSlightly(newSortingTreeNode);
    SortingTreeNode._queueUpdate(sceneSortingRecord, parentTreeNode);
    if (component instanceof SortingGroup) {
      debugLog?.log(`[NOTICE] Creating subtrees from ${component.name} top-to-bottom`);
      this._constructSubTree(sceneSortingRecord, newSortingTreeNode, component.node);
    }
    sceneSortingRecord.treeChangeContext.dirtyTreeNodes.push(parentTreeNode);
    return newSortingTreeNode;
  }

  private static _createComponentSortingTreeNode(sceneSortingRecord: SceneSortingRecord, component: SortingGroup | SortableRenderer) {
    const sortingTreeNode = new SortingTreeNode(component, sceneSortingRecord.treeNodeMap);
    sceneSortingRecord.treeNodeMap.set(component, sortingTreeNode);
    return sortingTreeNode;
  }

  private static _constructSubTree(sceneSortingRecord: SceneSortingRecord, sortingNode: SortingTreeNode, sceneNode: Node) {
    // All sortable renderers of CURRENT node are our children.
    for (const component of sceneNode.components) {
      if (SortableRenderer.is(component) && component.enabledInHierarchy) {
        let childTreeNode = sceneSortingRecord.treeNodeMap.get(component);
        if (childTreeNode) {
          // Add component to a node already involved in sorting tree.
          assert(childTreeNode._parent);
          childTreeNode._parent._removeChildSlightly(childTreeNode);
          SortingTreeNode._queueUpdate(sceneSortingRecord, childTreeNode._parent);
        } else {
          // Add a brand new sub tree.
          if (ENABLE_SORTING_TREE_DEBUG) {
            debugLog?.log(`Create(PASSIVE) sorting tree node for ${component.name}`);
          }
          childTreeNode = SortingTreeNode._createComponentSortingTreeNode(sceneSortingRecord, component);
        }
        sortingNode._addChildSlightly(childTreeNode);
      }
    }

    // For child scene nodes,
    for (const childSceneNode of sceneNode.children) {
      // If child scene node is a sorting group, then itself is our child,
      // but its child scene nodes are not our children.
      const childSortingGroup = childSceneNode.getComponent(SortingGroup);
      if (childSortingGroup && childSortingGroup.enabledInHierarchy) {
        let childTreeNode = sceneSortingRecord.treeNodeMap.get(childSortingGroup);
        if (childTreeNode) {
          // Add component to a node already involved in sorting tree.
          assert(childTreeNode._parent);
          childTreeNode._parent._removeChildSlightly(childTreeNode);
          SortingTreeNode._queueUpdate(sceneSortingRecord, childTreeNode._parent);
        } else {
          // Add a brand new sub tree.
          if (ENABLE_SORTING_TREE_DEBUG) {
            debugLog?.log(`Create(PASSIVE) sorting tree node for ${childSortingGroup.name}`);
          }
          childTreeNode = SortingTreeNode._createComponentSortingTreeNode(sceneSortingRecord, childSortingGroup);
          debugLog?.incIndent();
          this._constructSubTree(sceneSortingRecord, childTreeNode, childSceneNode);
          debugLog?.decIndent();
        }
        sortingNode._addChildSlightly(childTreeNode);
        continue;
      }

      // Otherwise, the child scene node is our child.
      this._constructSubTree(sceneSortingRecord, sortingNode, childSceneNode);
    }
  }

  private static _queueUpdate(sceneSortingRecord: SceneSortingRecord, sortingNode: SortingTreeNode) {
    const {
      rootTreeNode,
      treeChangeContext: {
        rootNodeInvolved,
        dirtyTreeNodes,
      },
    } = sceneSortingRecord;
    if (rootNodeInvolved) {
      return;
    }
    if (sortingNode === rootTreeNode) {
      sceneSortingRecord.treeChangeContext.rootNodeInvolved = true;
      return;
    }
    dirtyTreeNodes.push(sortingNode);
  }

  private constructor(
    private readonly _component: SortingGroup | SortableRenderer | undefined,
    private readonly _treeNodeMap: TreeNodeMap | undefined,
  ) {
    this._sortSettings = _component instanceof SortingGroup
      ? _component.sortSettings
      : _component
        ? _component[SortableRenderer.Tags.sortSettings]
        : undefined;
  }

  private _parent: SortingTreeNode | undefined = undefined;

  private _children: SortingTreeNode[] = [];

  private _sortingKeyStart = 0;

  private _sortingKeyEnd = 0;

  private _sortSettings: SortSettings | undefined = undefined;

  private _childrenSorted = true;

  private _ensureChildrenSorted() {
    if (!this._childrenSorted) {
      this._children.sort(SortingTreeNode._compareLocalSortingKey.bind(SortingTreeNode));
      this._childrenSorted = true;
    }
  }

  private _addChildSlightly(child: SortingTreeNode) {
    if (ENABLE_SORTING_TREE_DEBUG) {
      debugLog?.log(`${this._component?.name ?? '<root>'} ·---> ${child._component?.name ?? '<root>'}`);
    }
    assert(!child._parent);
    child._parent = this;
    this._children.push(child);
    this._childrenSorted = false;
  }

  private _removeChildSlightly(child: SortingTreeNode) {
    assert(child._parent === this);
    child._parent = undefined;
    this._children = this._children.filter((c) => c !== child);
  }

  private _transferChildren(children: SortingTreeNode[]) {
    children.forEach((child) => {
      child._parent = this;
    });
    this._children.push(...children);
    this._childrenSorted = false;
  }

  private _updateAll() {
    // Full sort
    this._ensureChildrenSorted();

    this._updateChildFrom(0);
    if (ENABLE_SORTING_TREE_DEBUG) {
      SortingTreeNode._printSortingTree?.(this);
    }
  }

  private _updateChild(child: SortingTreeNode) {
    const childIndex = this._children.indexOf(child);
    if (childIndex < 0) {
      return;
    }
    const affectingChildIndex = resort(
      this._children, childIndex, SortingTreeNode._compareLocalSortingKey.bind(SortingTreeNode));
    this._updateChildFrom(affectingChildIndex);
  }

  private _updateChildRangeSlightly(startChildIndex: number) {
    let sortingKey = startChildIndex === 0 ? this._sortingKeyStart : this._children[startChildIndex - 1]._sortingKeyEnd;
    for (let iChild = startChildIndex; iChild < this._children.length; iChild++) {
      const child = this._children[iChild];
      child._ensureChildrenSorted();
      child._sortingKeyStart = sortingKey;
      if (child._component && SortableRenderer.is(child._component)) {
        assert(child._children.length === 0);
        child._sortingKeyEnd = sortingKey + 1;
        child._component.setSortingKey(sortingKey);
        sortingKey = child._sortingKeyEnd;
      } else {
        child._updateChildRangeSlightly(0);
        sortingKey = child._sortingKeyEnd;
      }
    }
    this._sortingKeyEnd = sortingKey;
  }

  private _updateChildFrom(startChildIndex: number) {
    const oldSortingKey = this._sortingKeyEnd;
    this._updateChildRangeSlightly(startChildIndex);
    // Our elements keep the same sorting orders.
    if (oldSortingKey !== this._sortingKeyEnd) {
      // Notify parent we're changed.
      this._parent?._updateChild(this);
    }
  }
}

/**
 * 重新排序已经排序的数组的元素，只有 `index` 会被重新排序。
 * 返回插入位置。
 */
function resort<T>(array: T[], index: number, compare: (a: T, b: T) => number): number {
  const bound = lowerBoundIgnore(array, index, compare);
  if (bound === index) {
    return index;
  } else if (bound < index) {
    const element = array[index];
    for (let i = index - 1; i >= bound; i--) {
      array[i + 1] = array[i];
    }
    array[bound] = element;
    return bound;
  } else { // bound > index
    const element = array[index];
    for (let i = index; i < bound; i++) {
      array[i] = array[i + 1];
    }
    array[bound - 1] = element;
    return index;
  }
}

function lowerBoundIgnore<T>(array: T[], index: number, compare: (a: T, b: T) => number): number {
  const length = array.length;
  let iFirstGreaterThan = length;
  for (let i = 0; i < length; i++) {
    if (i === index) {
      continue;
    }
    if (compare(array[i], array[index]) > 0) {
      iFirstGreaterThan = i;
      break;
    }
  }
  return iFirstGreaterThan;
}
