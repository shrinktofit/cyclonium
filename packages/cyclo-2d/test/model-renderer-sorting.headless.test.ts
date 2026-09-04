import { ModelRenderer, Node, Scene, director } from 'cc';
import { describe, expect, it, vi } from 'vitest';
import { ModelRendererSorting } from '../src/model-renderer-sorting.component.js';

vi.mock('cc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('cc')>();
  return {
    ...actual,
    ModelRenderer: class extends actual.Component {
      priority = 0;
    },
    SortingLayers: {
      Enum: {
        default: 0,
      },
      getLayerIndex: (layer = 0) => layer,
    },
  };
});

describe('ModelRendererSorting', () => {
  it('writes sorting tree keys to ModelRenderer priorities', () => {
    /// @case
    /// Two ModelRenderer subclasses participate in the same sorting tree with different orders.
    /// @expect
    /// Each priority matches its sorting key and the lower order receives the lower priority.
    const scene = createRunningScene();
    const lateNode = createNode(scene, 'late model renderer');
    const lateRenderer = lateNode.addComponent(TestModelRenderer);
    const lateSorting = lateNode.addComponent(ModelRendererSorting);
    lateSorting.sortSettings.orderInLayer = 100;
    const earlyNode = createNode(scene, 'early model renderer');
    const earlyRenderer = earlyNode.addComponent(TestModelRenderer);
    const earlySorting = earlyNode.addComponent(ModelRendererSorting);
    earlySorting.sortSettings.orderInLayer = -100;

    expect(earlyRenderer.priority).toBe(earlySorting.sortSettings.sortingKey);
    expect(lateRenderer.priority).toBe(lateSorting.sortSettings.sortingKey);
    expect(earlyRenderer.priority).toBeLessThan(lateRenderer.priority);
  });

  it('disconnects and clears the renderer priority while disabled', () => {
    /// @case
    /// An enabled ModelRendererSorting has applied a non-zero sorting key and is then disabled.
    /// @expect
    /// It leaves the sorting tree, clears the stale renderer priority, and reconnects when enabled again.
    const node = createNode(createRunningScene(), 'model renderer');
    const renderer = node.addComponent(TestModelRenderer);
    const sorting = node.addComponent(ModelRendererSorting);
    sorting.setSortingKey(123);

    sorting.enabled = false;

    expect(sorting.sortSettings.connected).toBe(false);
    expect(renderer.priority).toBe(0);

    sorting.enabled = true;

    expect(sorting.sortSettings.connected).toBe(true);
  });

  it('keeps every ModelRenderer on the node synchronized', () => {
    /// @case
    /// Multiple concrete ModelRenderers are attached before one ModelRendererSorting component.
    /// @expect
    /// Sorting updates apply to every renderer and disabling clears every renderer priority.
    const node = createNode(createRunningScene(), 'multiple model renderers');
    const rendererA = node.addComponent(TestModelRenderer);
    const rendererB = node.addComponent(TestModelRenderer);
    const sorting = node.addComponent(ModelRendererSorting);

    sorting.setSortingKey(123);

    expect(rendererA.priority).toBe(123);
    expect(rendererB.priority).toBe(123);

    sorting.enabled = false;

    expect(rendererA.priority).toBe(0);
    expect(rendererB.priority).toBe(0);
  });
});

class TestModelRenderer extends ModelRenderer {}

function createRunningScene(): Scene {
  const scene = new Scene('model renderer sorting scene');
  director.runSceneImmediate(scene);
  return scene;
}

function createNode(parent: Node, name: string): Node {
  const node = new Node(name);
  parent.addChild(node);
  return node;
}
