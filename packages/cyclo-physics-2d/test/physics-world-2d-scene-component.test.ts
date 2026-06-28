import { describe, expect, it, vi } from 'vitest';
import { Node, Scene } from 'cc';
import { PhysicsWorld2DSceneComponent } from '@/physics-world-2d-scene-component.js';

const debuggerDestroy = vi.hoisted(() => vi.fn());

vi.mock('#physics-2d-debugger', () => ({
  Physics2DDebugger: class {
    destroy = debuggerDestroy;

    render() {}
  },
}));

describe('PhysicsWorld2DSceneComponent', () => {
  it('should destroy the debug renderer when debug is disabled', () => {
    /// @case
    /// 1. Debug is enabled after the physics world exists.
    /// 2. Debug is disabled at runtime.
    /// @expect
    /// The existing Physics2DDebugger is destroyed so its render node/model is removed.
    const scene = new Scene('physics-world-2d-scene-component-test');
    const node = new Node('physics-scene');
    scene.addChild(node);
    const physicsScene = node.addComponent(PhysicsWorld2DSceneComponent);
    (physicsScene as unknown as { _physicsWorld: { impl: object } })._physicsWorld = { impl: {} };

    physicsScene.debug = true;
    expect(debuggerDestroy).not.toHaveBeenCalled();

    physicsScene.debug = false;
    expect(debuggerDestroy).toHaveBeenCalledTimes(1);

    scene.destroy();
  });
});
