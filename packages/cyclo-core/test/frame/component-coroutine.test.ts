import { AbortController } from '@cyclonium/abort-controller';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { director, Node, Scene } from 'cc';
import {
  nextFrame,
  waitFor,
  waitUntil,
  waitWhile,
  type Coroutine,
  type CoroutineIterator,
} from '@/export/framework.js';
import { CaptureArray } from '../utils/capture-array.js';
import { ComponentLifeCycleObserver } from './component-life-cycle-observer.js';

let scene: Scene | undefined;

afterEach(() => {
  scene?.destroy();
  scene = undefined;
});

describe('CycloComponent coroutine', () => {
  it('should resume from component update with frame context', () => {
    const { component } = createProbe();
    const events = new CaptureArray<string>();
    const yields = new CaptureArray<unknown>();
    const coroutine = vi.fn(function* (): CoroutineIterator {
      events.push('start');
      yields.push(yield nextFrame());
      events.push('resumed');
    });
    component.invokeStartCoroutine(coroutine);
    expect(coroutine).toHaveBeenCalledTimes(1);
    coroutine.mockClear();
    expect(events.capture()).toEqual(['start']);

    director.tick(0.125);
    expect(events.capture()).toEqual(['resumed']);
    expect(yields.capture()).toEqual([
      {
        deltaTime: 0.125,
        elapsedTime: 0.125,
        frame: 1,
      },
    ]);
  });

  it('should wait with frame, time, until, and while instructions', () => {
    const { component } = createProbe();
    const events = new CaptureArray<string>();
    const yields = new CaptureArray<unknown>();
    let ready = false;
    let blocking = true;
    component.invokeStartCoroutine(function* (): CoroutineIterator {
      events.push('start');
      for (let i = 0; i < 2; i++) {
        yields.push(yield nextFrame());
      }
      events.push('after-frames');
      yields.push(yield waitFor(0.25));
      events.push('after-seconds');
      yields.push(yield waitUntil(() => ready));
      events.push('after-until');
      yields.push(yield waitWhile(() => blocking));
      events.push('after-while');
    });

    director.tick(0.1);
    expect(events.capture()).toEqual(['start']);
    expect(yields.capture()).toEqual([
      expect.objectContaining({
        frame: 1,
      }),
    ]);

    director.tick(0.1);
    expect(events.capture()).toEqual(['after-frames']);
    expect(yields.capture()).toEqual([
      expect.objectContaining({
        frame: 2,
      }),
    ]);

    director.tick(0.1);
    expect(events.capture()).toEqual([]);
    expect(yields.capture()).toEqual([]);

    director.tick(0.15);
    expect(events.capture()).toEqual(['after-seconds']);
    expect(yields.capture()).toEqual([
      expect.objectContaining({
        elapsedTime: expect.closeTo(0.45),
      }),
    ]);

    director.tick(0.1);
    expect(events.capture()).toEqual([]);
    expect(yields.capture()).toEqual([]);

    ready = true;
    director.tick(0.1);
    expect(events.capture()).toEqual(['after-until']);
    expect(yields.capture()).toEqual([
      expect.objectContaining({
        frame: 6,
      }),
    ]);

    director.tick(0.1);
    expect(events.capture()).toEqual([]);
    expect(yields.capture()).toEqual([]);

    blocking = false;
    director.tick(0.1);
    expect(events.capture()).toEqual(['after-while']);
    expect(yields.capture()).toEqual([
      expect.objectContaining({
        frame: 8,
      }),
    ]);
  });

  it('should resume synchronously started coroutines in start order', () => {
    const { component } = createProbe();
    const events = new CaptureArray<string>();

    component.invokeStartCoroutine(function* (): CoroutineIterator {
      events.push('first-start');
      yield nextFrame();
      events.push('first-resumed');
      yield nextFrame();
      events.push('first-resumed-again');
    });
    component.invokeStartCoroutine(function* (): CoroutineIterator {
      events.push('second-start');
      yield nextFrame();
      events.push('second-resumed');
      yield nextFrame();
      events.push('second-resumed-again');
    });

    expect(events.capture()).toEqual(['first-start', 'second-start']);

    director.tick(0.1);
    expect(events.capture()).toEqual(['first-resumed', 'second-resumed']);

    director.tick(0.1);
    expect(events.capture()).toEqual(['first-resumed-again', 'second-resumed-again']);
  });

  it('should stop a component coroutine when its signal is aborted', () => {
    const { component } = createProbe();
    const controller = new AbortController();
    const events = new CaptureArray<string>();
    component.invokeStartCoroutine(function* (): CoroutineIterator {
      try {
        events.push('start');
        yield waitUntil(() => false);
      } finally {
        events.push('cleanup');
      }
    }, {
      signal: controller.signal,
    });

    director.tick(0.1);
    expect(events.capture()).toEqual(['start']);

    controller.abort();
    expect(events.capture()).toEqual(['cleanup']);

    director.tick(0.1);
    expect(events.capture()).toEqual([]);
  });

  it('should keep component coroutines running when the component is disabled', () => {
    const { component } = createProbe();
    const events = new CaptureArray<string>();
    component.invokeStartCoroutine(function* (): CoroutineIterator {
      events.push('start');
      yield nextFrame();
      events.push('after-first-frame');
      yield nextFrame();
      events.push('after-disabled');
    });

    expect(events.capture()).toEqual(['start']);

    director.tick(0.1);
    expect(events.capture()).toEqual(['after-first-frame']);

    component.enabled = false;
    director.tick(0.1);
    expect(events.capture()).toEqual(['after-disabled']);
  });

  it('should stop component coroutines when the node is inactive', () => {
    const { component, node } = createProbe();
    const events = new CaptureArray<string>();
    component.invokeStartCoroutine(function* (): CoroutineIterator {
      try {
        events.push('start');
        yield waitUntil(() => false);
      } finally {
        events.push('cleanup');
      }
    });

    expect(events.capture()).toEqual(['start']);

    node.active = false;
    expect(events.capture()).toEqual(['cleanup']);
  });

  it('should defer component coroutines started during coroutine update to the next frame', () => {
    const starter = createProbe('starter').component;
    const target = createProbe('target').component;
    const events = new CaptureArray<string>();

    starter.invokeStartCoroutine(function* (): CoroutineIterator {
      yield nextFrame();
      events.push('starter-resumed');
      target.invokeStartCoroutine(function* (): CoroutineIterator {
        events.push('target-start');
        yield nextFrame();
        events.push('target-resumed');
      });
      events.push('starter-after-start');
    });

    director.tick(0.1);
    expect(events.capture()).toEqual([
      'starter-resumed',
      'target-start',
      'starter-after-start',
    ]);

    director.tick(0.1);
    expect(events.capture()).toEqual(['target-resumed']);
  });

  it('should stop a coroutine from another coroutine', () => {
    const { component } = createProbe();
    const events = new CaptureArray<string>();
    let childHandle: Coroutine | undefined = undefined;

    childHandle = component.invokeStartCoroutine(function* (): CoroutineIterator {
      try {
        events.push('child-start');
        yield waitUntil(() => false);
        events.push('child-unreachable');
      } finally {
        events.push('child-cleanup');
      }
    });
    component.invokeStartCoroutine(function* (): CoroutineIterator {
      events.push('stopper-start');
      yield nextFrame();
      if (!childHandle) {
        throw new Error('Expected child coroutine handle.');
      }
      component.invokeStopCoroutine(childHandle);
      events.push('stopper-after-stop');
    });

    expect(events.capture()).toEqual(['child-start', 'stopper-start']);

    director.tick(0.1);
    expect(events.capture()).toEqual(['child-cleanup', 'stopper-after-stop']);

    director.tick(0.1);
    expect(events.capture()).toEqual([]);
  });

  it('should skip a later coroutine stopped during coroutine update', () => {
    const { component } = createProbe();
    const events = new CaptureArray<string>();
    let targetHandle: Coroutine | undefined = undefined;

    component.invokeStartCoroutine(function* (): CoroutineIterator {
      events.push('stopper-start');
      yield nextFrame();
      events.push('stopper-before-stop');
      if (!targetHandle) {
        throw new Error('Expected target coroutine handle.');
      }
      component.invokeStopCoroutine(targetHandle);
      events.push('stopper-after-stop');
    });
    targetHandle = component.invokeStartCoroutine(function* (): CoroutineIterator {
      try {
        events.push('target-start');
        yield nextFrame();
        events.push('target-resumed');
      } finally {
        events.push('target-cleanup');
      }
    });

    expect(events.capture()).toEqual(['stopper-start', 'target-start']);

    director.tick(0.1);
    expect(events.capture()).toEqual(['stopper-before-stop', 'target-cleanup', 'stopper-after-stop']);

    director.tick(0.1);
    expect(events.capture()).toEqual([]);
  });

  it('should skip later coroutines after stop all during coroutine update', () => {
    const { component } = createProbe();
    const events = new CaptureArray<string>();

    component.invokeStartCoroutine(function* (): CoroutineIterator {
      events.push('stopper-start');
      yield nextFrame();
      events.push('stopper-before-stop-all');
      component.invokeStopAllCoroutines();
      events.push('stopper-after-stop-all');
      yield nextFrame();
      events.push('stopper-unreachable');
    });
    component.invokeStartCoroutine(function* (): CoroutineIterator {
      try {
        events.push('target-start');
        yield nextFrame();
        events.push('target-resumed');
      } finally {
        events.push('target-cleanup');
      }
    });

    expect(events.capture()).toEqual(['stopper-start', 'target-start']);

    director.tick(0.1);
    expect(events.capture()).toEqual([
      'stopper-before-stop-all',
      'target-cleanup',
      'stopper-after-stop-all',
    ]);

    director.tick(0.1);
    expect(events.capture()).toEqual([]);
  });

  it('should stop all coroutines from a coroutine', () => {
    const { component } = createProbe();
    const events = new CaptureArray<string>();

    component.invokeStartCoroutine(function* (): CoroutineIterator {
      try {
        events.push('first-start');
        yield waitUntil(() => false);
        events.push('first-unreachable');
      } finally {
        events.push('first-cleanup');
      }
    });
    component.invokeStartCoroutine(function* (): CoroutineIterator {
      try {
        events.push('second-start');
        yield waitUntil(() => false);
        events.push('second-unreachable');
      } finally {
        events.push('second-cleanup');
      }
    });
    component.invokeStartCoroutine(function* (): CoroutineIterator {
      events.push('stopper-start');
      yield nextFrame();
      events.push('stopper-before-stop-all');
      component.invokeStopAllCoroutines();
      events.push('stopper-after-stop-all');
      yield nextFrame();
      events.push('stopper-unreachable');
    });

    expect(events.capture()).toEqual(['first-start', 'second-start', 'stopper-start']);

    director.tick(0.1);
    expect(events.capture()).toEqual([
      'stopper-before-stop-all',
      'first-cleanup',
      'second-cleanup',
      'stopper-after-stop-all',
    ]);

    director.tick(0.1);
    expect(events.capture()).toEqual([]);
  });

  it('should stop every coroutine when a cleanup stops another coroutine during stop all', () => {
    const { component } = createProbe();
    const events = new CaptureArray<string>();
    let secondHandle: Coroutine | undefined = undefined;

    component.invokeStartCoroutine(function* (): CoroutineIterator {
      try {
        events.push('first-start');
        yield waitUntil(() => false);
      } finally {
        events.push('first-cleanup');
        if (secondHandle) {
          component.invokeStopCoroutine(secondHandle);
        }
        events.push('first-after-stop-second');
      }
    });
    secondHandle = component.invokeStartCoroutine(function* (): CoroutineIterator {
      try {
        events.push('second-start');
        yield waitUntil(() => false);
      } finally {
        events.push('second-cleanup');
      }
    });
    component.invokeStartCoroutine(function* (): CoroutineIterator {
      try {
        events.push('third-start');
        yield waitUntil(() => false);
      } finally {
        events.push('third-cleanup');
      }
    });

    expect(events.capture()).toEqual(['first-start', 'second-start', 'third-start']);

    expect(() => {
      component.invokeStopAllCoroutines();
    }).not.toThrow();
    expect(events.capture()).toEqual([
      'first-cleanup',
      'second-cleanup',
      'first-after-stop-second',
      'third-cleanup',
    ]);
  });

  it('should keep a coroutine started during stop all cleanup scheduled', () => {
    const { component } = createProbe();
    const events = new CaptureArray<string>();

    component.invokeStartCoroutine(function* (): CoroutineIterator {
      try {
        events.push('original-start');
        yield waitUntil(() => false);
      } finally {
        events.push('original-cleanup');
        component.invokeStartCoroutine(function* (): CoroutineIterator {
          events.push('replacement-start');
          yield nextFrame();
          events.push('replacement-resumed');
        });
      }
    });

    expect(events.capture()).toEqual(['original-start']);

    component.invokeStopAllCoroutines();
    expect(events.capture()).toEqual(['original-cleanup', 'replacement-start']);

    director.tick(0.1);
    expect(events.capture()).toEqual(['replacement-resumed']);
  });
});

function createProbe(name = 'probe'): { component: ComponentLifeCycleObserver; node: Node } {
  if (!scene) {
    scene = new Scene('component-coroutine-test');
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
