import { afterEach, expect, it } from 'vitest';
import { director, Node, Scene } from 'cc';
import { nextFrame, type CoroutineIterator } from '@/export/framework.js';
import { CaptureArray } from '../utils/capture-array.js';
import { ComponentLifeCycleObserver } from './component-life-cycle-observer.js';

let scene: Scene | undefined;

afterEach(() => {
  scene?.destroy();
  scene = undefined;
});

it('component life cycle method execution order', () => {
  const first = createObserver('first').component;
  const second = createObserver('second').component;
  const events = new CaptureArray<string>();

  first.onUpdateCallback = () => {
    events.push('first-update');
  };
  second.onUpdateCallback = () => {
    events.push('second-update');
  };
  first.onFixedUpdateCallback = () => {
    events.push('first-fixed-update');
  };
  second.onFixedUpdateCallback = () => {
    events.push('second-fixed-update');
  };
  first.onLateUpdateCallback = () => {
    events.push('first-late-update');
  };
  second.onLateUpdateCallback = () => {
    events.push('second-late-update');
  };

  first.invokeStartCoroutine(function* (): CoroutineIterator {
    yield nextFrame();
    events.push('first-coroutine');
  });
  second.invokeStartCoroutine(function* (): CoroutineIterator {
    yield nextFrame();
    events.push('second-coroutine');
  });

  director.tick(1 / 60);

  expect(events.capture()).toEqual([
    'first-update',
    'second-update',
    'first-coroutine',
    'second-coroutine',
    'first-fixed-update',
    'second-fixed-update',
    'first-late-update',
    'second-late-update',
  ]);
});

function createObserver(name = 'observer'): { component: ComponentLifeCycleObserver; node: Node } {
  if (!scene) {
    scene = new Scene('component-test');
    director.runSceneImmediate(scene);
  }

  const node = new Node(name);
  const component = node.addComponent(ComponentLifeCycleObserver);
  scene.addChild(node);

  return {
    component,
    node,
  };
}
