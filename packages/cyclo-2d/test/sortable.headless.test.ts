import { describe, expect, it, vi } from 'vitest';
import { Component, director, Node, Scene } from 'cc';
import { MAX_ORDER_IN_LAYER, computeLocalSortingKey } from '../src/sortable.js';
import { SortableRenderer } from '../src/sortable.js';
import { SortSettings } from '../src/sort-settings.js';
import { SortingGroup } from '../src/sorting-group.component.js';

vi.mock('cc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('cc')>();
  return {
    ...actual,
    SortingLayers: {
      Enum: {
        default: 0,
      },
    },
  };
});

describe('computeLocalSortingKey', () => {
  it('packs sorting layer and order in layer into a monotonic key', () => {
    const lower = sortSettings(1, -10);
    const higher = sortSettings(1, 10);
    const nextLayer = sortSettings(2, -MAX_ORDER_IN_LAYER);

    expect(computeLocalSortingKey(lower)).toBeLessThan(computeLocalSortingKey(higher));
    expect(computeLocalSortingKey(higher)).toBeLessThan(computeLocalSortingKey(nextLayer));
  });
});

describe('SortingTree', () => {
  it('sorts renderer keys by scene hierarchy and group-local order', () => {
    const scene = createScene('sorting scene');
    const lowNode = createNode(scene, 'low');
    const groupNode = createNode(scene, 'group');
    const highNode = createNode(scene, 'high');

    const low = addRenderer(lowNode, 0);
    const group = addSortingGroup(groupNode, 10);
    const high = addRenderer(highNode, 20);

    const groupEarly = addRenderer(createNode(groupNode, 'group early'), -100);
    const groupLate = addRenderer(createNode(groupNode, 'group late'), 100);

    connectAll(low, group, high, groupEarly, groupLate);

    expectSortingKeys([
      low.sortSettings,
      groupEarly.sortSettings,
      groupLate.sortSettings,
      high.sortSettings,
    ]);
  });

  it('keeps nested sorting groups as contiguous ranges', () => {
    const scene = createScene('nested sorting scene');
    const before = addRenderer(createNode(scene, 'before'), 0);
    const outerNode = createNode(scene, 'outer');
    const outer = addSortingGroup(outerNode, 10);
    const after = addRenderer(createNode(scene, 'after'), 20);

    const outerSibling = addRenderer(createNode(outerNode, 'outer sibling'), 0);
    const innerNode = createNode(outerNode, 'inner');
    const inner = addSortingGroup(innerNode, -10);
    const innerChildA = addRenderer(createNode(innerNode, 'inner child a'), 100);
    const innerChildB = addRenderer(createNode(innerNode, 'inner child b'), 200);

    connectAll(before, outer, after, outerSibling, inner, innerChildA, innerChildB);

    expectSortingKeys([
      before.sortSettings,
      innerChildA.sortSettings,
      innerChildB.sortSettings,
      outerSibling.sortSettings,
      after.sortSettings,
    ]);
  });

  it('updates observable sorting keys when sort settings change', () => {
    const scene = createScene('dynamic sorting scene');
    const first = addRenderer(createNode(scene, 'first'), 0);
    const second = addRenderer(createNode(scene, 'second'), 10);
    const third = addRenderer(createNode(scene, 'third'), 20);

    connectAll(third, second, first);
    const initialThirdSortingKey = third.sortSettings.sortingKey;

    third.sortSettings.orderInLayer = -10;

    expect(third.sortSettings.sortingKey).toBeLessThan(initialThirdSortingKey);
    expect(third.sortSettings.sortingKey).toBeLessThan(first.sortSettings.sortingKey);
    expect(third.sortSettings.sortingKey).toBeLessThan(second.sortSettings.sortingKey);
    expect(third.lastSortingKey).toBe(third.sortSettings.sortingKey);
  });

  it('updates sorting keys when renderers are dynamically inserted before, after, between, and as siblings', () => {
    const scene = createScene('dynamic renderer insertion scene');
    const early = addRenderer(createNode(scene, 'early'), 0);
    const middleAnchorNode = createNode(scene, 'middle anchor');
    const middleAnchor = addRenderer(middleAnchorNode, 20);
    const late = addRenderer(createNode(scene, 'late'), 40);
    connectAll(early, middleAnchor, late);

    const before = addRenderer(createNode(scene, 'before'), -10);
    before.sortSettings.connect(before);
    expectSortingKeys([
      before.sortSettings,
      early.sortSettings,
      middleAnchor.sortSettings,
      late.sortSettings,
    ]);

    const between = addRenderer(createNode(scene, 'between'), 10);
    between.sortSettings.connect(between);
    expectSortingKeys([
      before.sortSettings,
      early.sortSettings,
      between.sortSettings,
      middleAnchor.sortSettings,
      late.sortSettings,
    ]);

    const after = addRenderer(createNode(scene, 'after'), 50);
    after.sortSettings.connect(after);
    expectSortingKeys([
      before.sortSettings,
      early.sortSettings,
      between.sortSettings,
      middleAnchor.sortSettings,
      late.sortSettings,
      after.sortSettings,
    ]);

    const siblingOnSameNode = addRenderer(middleAnchorNode, 30);
    siblingOnSameNode.sortSettings.connect(siblingOnSameNode);
    expectSortingKeys([
      before.sortSettings,
      early.sortSettings,
      between.sortSettings,
      middleAnchor.sortSettings,
      siblingOnSameNode.sortSettings,
      late.sortSettings,
      after.sortSettings,
    ]);
  });

  it('updates sorting keys when sorting groups are dynamically inserted before, after, and between sorted renderers', () => {
    const scene = createScene('dynamic group insertion scene');
    const early = addRenderer(createNode(scene, 'early'), 0);
    const middle = addRenderer(createNode(scene, 'middle'), 40);
    const late = addRenderer(createNode(scene, 'late'), 80);
    connectAll(early, middle, late);

    const before = createSortingGroupTree(scene, 'before group', -20, [
      ['before group late child', 20],
      ['before group early child', -20],
    ]);
    connectSortingGroupTree(before);
    expectSortingKeys([
      before.renderers[1].sortSettings,
      before.renderers[0].sortSettings,
      early.sortSettings,
      middle.sortSettings,
      late.sortSettings,
    ]);

    const between = createSortingGroupTree(scene, 'between group', 20, [
      ['between group late child', 10],
      ['between group early child', -10],
    ]);
    connectSortingGroupTree(between);
    expectSortingKeys([
      before.renderers[1].sortSettings,
      before.renderers[0].sortSettings,
      early.sortSettings,
      between.renderers[1].sortSettings,
      between.renderers[0].sortSettings,
      middle.sortSettings,
      late.sortSettings,
    ]);

    const after = createSortingGroupTree(scene, 'after group', 100, [
      ['after group late child', 10],
      ['after group early child', -10],
    ]);
    connectSortingGroupTree(after);
    expectSortingKeys([
      before.renderers[1].sortSettings,
      before.renderers[0].sortSettings,
      early.sortSettings,
      between.renderers[1].sortSettings,
      between.renderers[0].sortSettings,
      middle.sortSettings,
      late.sortSettings,
      after.renderers[1].sortSettings,
      after.renderers[0].sortSettings,
    ]);
  });

  it('regroups existing sorted descendants when a sorting group is dynamically enabled', () => {
    const scene = createScene('dynamic group enabling scene');
    const before = addRenderer(createNode(scene, 'before'), 0);
    const groupNode = createNode(scene, 'group holder');
    const childHigh = addRenderer(createNode(groupNode, 'child high'), 100);
    const childLow = addRenderer(createNode(groupNode, 'child low'), -100);
    const after = addRenderer(createNode(scene, 'after'), 20);
    connectAll(before, childHigh, childLow, after);

    expectSortingKeys([
      childLow.sortSettings,
      before.sortSettings,
      after.sortSettings,
      childHigh.sortSettings,
    ]);

    const group = addSortingGroup(groupNode, 10);
    group.sortSettings.connect(group);

    expectSortingKeys([
      before.sortSettings,
      childLow.sortSettings,
      childHigh.sortSettings,
      after.sortSettings,
    ]);
  });

  it('ignores inactive renderers and inactive sorting groups during passive tree construction', () => {
    const scene = createScene('inactive component scene');
    const activeBefore = addRenderer(createNode(scene, 'active before'), 0);
    const inactiveRenderer = addRenderer(createNode(scene, 'inactive renderer'), -100, 0, false);
    const activeAfter = addRenderer(createNode(scene, 'active after'), 20);
    connectAll(activeBefore, activeAfter);

    expect(inactiveRenderer.sortSettings.sortingKey).toBe(0);
    expectSortingKeys([
      activeBefore.sortSettings,
      activeAfter.sortSettings,
    ]);

    const inactiveGroupNode = createNode(scene, 'inactive group');
    const inactiveGroup = addSortingGroup(inactiveGroupNode, 10, 0, false);
    const groupChildEarly = addRenderer(createNode(inactiveGroupNode, 'group child early'), -100);
    const groupChildLate = addRenderer(createNode(inactiveGroupNode, 'group child late'), 100);
    connectAll(groupChildEarly, groupChildLate);

    expect(inactiveGroup.sortSettings.sortingKey).toBe(0);
    expectSortingKeys([
      groupChildEarly.sortSettings,
      activeBefore.sortSettings,
      activeAfter.sortSettings,
      groupChildLate.sortSettings,
    ]);
  });

  it('reparents descendants when an inactive sorting group becomes active and connects', () => {
    const scene = createScene('inactive group activation scene');
    const before = addRenderer(createNode(scene, 'before'), 0);
    const inactiveGroupNode = createNode(scene, 'inactive group');
    const inactiveGroup = addSortingGroup(inactiveGroupNode, 10, 0, false);
    const childHigh = addRenderer(createNode(inactiveGroupNode, 'child high'), 100);
    const childLow = addRenderer(createNode(inactiveGroupNode, 'child low'), -100);
    const after = addRenderer(createNode(scene, 'after'), 20);
    connectAll(before, childHigh, childLow, after);

    expectSortingKeys([
      childLow.sortSettings,
      before.sortSettings,
      after.sortSettings,
      childHigh.sortSettings,
    ]);

    setEnabledInHierarchy(inactiveGroup, true);
    inactiveGroup.sortSettings.connect(inactiveGroup);

    expectSortingKeys([
      before.sortSettings,
      childLow.sortSettings,
      childHigh.sortSettings,
      after.sortSettings,
    ]);
  });

  it('promotes descendants back to the parent chain when an active sorting group becomes inactive', () => {
    const scene = createScene('group deactivation scene');
    const before = addRenderer(createNode(scene, 'before'), 0);
    const groupNode = createNode(scene, 'group');
    const group = addSortingGroup(groupNode, 10);
    const childHigh = addRenderer(createNode(groupNode, 'child high'), 100);
    const childLow = addRenderer(createNode(groupNode, 'child low'), -100);
    const after = addRenderer(createNode(scene, 'after'), 20);
    connectAll(before, group, childHigh, childLow, after);

    expectSortingKeys([
      before.sortSettings,
      childLow.sortSettings,
      childHigh.sortSettings,
      after.sortSettings,
    ]);

    setEnabledInHierarchy(group, false);
    group.sortSettings.disconnect();

    expectSortingKeys([
      childLow.sortSettings,
      before.sortSettings,
      after.sortSettings,
      childHigh.sortSettings,
    ]);
  });

  it('disconnects a renderer after SpriteRenderer-style disable, enable, and disable lifecycle operations', () => {
    const scene = createRunningScene('renderer lifecycle scene');
    const renderer = addLifecycleRenderer(createNode(scene, 'renderer'), 0);

    renderer.enabled = false;
    expect(renderer.sortSettings.connected).toBe(false);

    renderer.enabled = true;
    expect(renderer.sortSettings.connected).toBe(true);

    renderer.enabled = false;
    expect(renderer.sortSettings.connected).toBe(false);

    expect(() => {
      renderer.enabled = true;
    }).not.toThrow();
    expect(renderer.sortSettings.connected).toBe(true);

    expect(() => {
      renderer.enabled = false;
    }).not.toThrow();
    expect(renderer.sortSettings.connected).toBe(false);
  });
});

function sortSettings(sortingLayer: number, orderInLayer: number): SortSettings {
  return {
    sortingLayer,
    orderInLayer,
  } as SortSettings;
}

class TestSortableRenderer extends Component implements SortableRenderer {
  readonly sortSettings = new SortSettings();

  lastSortingKey = 0;

  get [SortableRenderer.Tags.sortSettings]() {
    return this.sortSettings;
  }

  setSortingKey(sortingKey: number): void {
    this.lastSortingKey = sortingKey;
  }
}

class TestLifecycleSortableRenderer extends TestSortableRenderer {
  readonly sortingKeyUpdates: number[] = [];

  override setSortingKey(sortingKey: number): void {
    super.setSortingKey(sortingKey);
    this.sortingKeyUpdates.push(sortingKey);
  }

  protected override onEnable(): void {
    this.sortSettings.connect(this);
  }

  protected override onDisable(): void {
    this.sortSettings.disconnect();
    this.setSortingKey(0);
  }
}

function createNode(parent: Node, name: string) {
  const node = new Node(name);
  defineScene(node, parent.scene);
  parent.addChild(node);
  return node;
}

function createScene(name: string) {
  const scene = new Node(name) as Scene;
  defineScene(scene, scene);
  return scene;
}

function createRunningScene(name: string) {
  const scene = new Scene(name);
  director.runSceneImmediate(scene);
  return scene;
}

function defineScene(node: Node, scene: Scene) {
  Object.defineProperty(node, 'scene', {
    configurable: true,
    get: () => scene,
  });
}

function addRenderer(node: Node, orderInLayer: number, sortingLayer = 0, enabledInHierarchy = true) {
  const renderer = node.addComponent(TestSortableRenderer);
  defineEnabledInHierarchy(renderer, enabledInHierarchy);
  renderer.sortSettings.sortingLayer = sortingLayer;
  renderer.sortSettings.orderInLayer = orderInLayer;
  return renderer;
}

function addLifecycleRenderer(node: Node, orderInLayer: number, sortingLayer = 0, enabledInHierarchy = true) {
  const renderer = node.addComponent(TestLifecycleSortableRenderer);
  defineEnabledInHierarchy(renderer, enabledInHierarchy);
  renderer.sortSettings.sortingLayer = sortingLayer;
  renderer.sortSettings.orderInLayer = orderInLayer;
  return renderer;
}

function addSortingGroup(node: Node, orderInLayer: number, sortingLayer = 0, enabledInHierarchy = true) {
  const group = node.addComponent(SortingGroup);
  defineEnabledInHierarchy(group, enabledInHierarchy);
  group.sortSettings.sortingLayer = sortingLayer;
  group.sortSettings.orderInLayer = orderInLayer;
  return group;
}

function defineEnabledInHierarchy(component: Component, enabledInHierarchy: boolean) {
  componentEnabledInHierarchy.set(component, enabledInHierarchy);
  Object.defineProperty(component, 'enabledInHierarchy', {
    configurable: true,
    get: () => (componentEnabledInHierarchy.get(component) ?? false) && component.enabled,
  });
}

function setEnabledInHierarchy(component: Component, enabledInHierarchy: boolean) {
  componentEnabledInHierarchy.set(component, enabledInHierarchy);
}

function connectAll(...components: Array<TestSortableRenderer | SortingGroup>) {
  for (const component of components) {
    component.sortSettings.connect(component);
  }
}

function createSortingGroupTree(parent: Node, name: string, orderInLayer: number, rendererEntries: readonly (readonly [name: string, orderInLayer: number])[]) {
  const node = createNode(parent, name);
  const group = addSortingGroup(node, orderInLayer);
  const renderers = rendererEntries.map(([rendererName, rendererOrderInLayer]) => {
    return addRenderer(createNode(node, rendererName), rendererOrderInLayer);
  });
  return {
    group,
    renderers,
  };
}

function connectSortingGroupTree(tree: ReturnType<typeof createSortingGroupTree>) {
  tree.group.sortSettings.connect(tree.group);
  for (const renderer of tree.renderers) {
    renderer.sortSettings.connect(renderer);
  }
}

function expectSortingKeys(sortSettingsList: readonly SortSettings[]) {
  const keys = sortSettingsList.map((sortSettings) => sortSettings.sortingKey);
  for (let i = 1; i < sortSettingsList.length; i++) {
    expect(keys[i - 1], `sorting keys: ${keys.join(', ')}`).toBeLessThan(keys[i]);
  }
}

const componentEnabledInHierarchy = new WeakMap<Component, boolean>();
