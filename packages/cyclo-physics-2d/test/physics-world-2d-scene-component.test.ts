import { describe, expect, it, vi } from 'vitest';
import { director, Node, Scene } from 'cc';
import { Transform2DComponent } from '@cyclonium/core/2d';
import { toRadians } from '@cyclonium/core/math/trigonometry';
import { Vec2 } from '@cyclonium/core/math/vec2';
import { PhysicsWorld2DSceneComponent } from '@/physics-world-2d-scene-component.js';
import { Physics2DSettings } from '@/physics-2d-settings.js';
import { RigidBody2D, RigidBody2DType } from '@/rigid-body-2d.js';
import { CircleCollider2D } from '@/colliders/circle-collider-2d.js';
import { logger } from '@cyclonium/core/log';

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

  it('should advance a direct world step by the requested delta time', () => {
    /// @case
    /// 1. A velocity-based kinematic body moves at 6 units per second.
    /// 2. Its physics world advances once with a 1/30-second timestep.
    /// @expect
    /// The body advances by 0.2 units instead of the backend default 1/60-second distance.
    const fixture = createMovingBodyFixture();

    fixture.physicsScene.physicsWorld!.step(1 / 30);

    expect(fixture.transform.position.x).toBeCloseTo(0.2);
    fixture.scene.destroy();
  });

  it('should run configured fixed substeps for an engine update', () => {
    /// @case
    /// 1. A physics scene is configured for 60 fixed steps per second.
    /// 2. The engine advances by one 1/30-second update.
    /// @expect
    /// Physics advances two 1/60-second substeps and covers the full engine delta time.
    const fixture = createMovingBodyFixture();

    director.tick(1 / 30);

    expect(fixture.transform.position.x).toBeCloseTo(0.2);
    fixture.scene.destroy();
  });

  it('should distribute a position-based kinematic target across substeps', () => {
    /// @case
    /// 1. A position-based kinematic body receives a 0.2-unit target before a 1/30-second engine update.
    /// 2. The physics scene advances that update as two 1/60-second substeps.
    /// @expect
    /// The body reaches the target with the same 6-unit-per-second velocity during the final substep instead of stopping after the first.
    const fixture = createMovingBodyFixture({ bodyType: RigidBody2DType.kinematicPositionBased });
    fixture.body.setNextKinematicPosition(new Vec2(0.2, 0));

    director.tick(1 / 30);

    expect(fixture.transform.position.x).toBeCloseTo(0.2);
    expect(fixture.body.linearVelocity.x).toBeCloseTo(6);
    fixture.scene.destroy();
  });

  it('should emit contact lifecycle events for each configured physics substep', () => {
    /// @case
    /// 1. Two colliders start overlapped in a 60-Hz physics scene.
    /// 2. The engine advances by one 1/30-second update.
    /// @expect
    /// The first 1/60 substep emits begin and the second emits stay, proving that two backend steps ran.
    const fixture = createContactingPositionBodyFixture();

    director.tick(1 / 30);

    expect(fixture.contactRotations).toHaveLength(2);
    fixture.scene.destroy();
  });

  it('should distribute a position-based kinematic rotation across substeps', () => {
    /// @case
    /// 1. A position-based kinematic body receives a PI/2 rotation target.
    /// 2. A 1/30-second update advances as two 1/60-second physics substeps.
    /// @expect
    /// Contact callbacks observe PI/4 after the first substep and PI/2 after the second instead of the target being consumed immediately.
    const fixture = createContactingPositionBodyFixture();
    fixture.body.setNextKinematicRotation(Math.PI / 2);

    director.tick(1 / 30);

    expect(fixture.contactRotations[0]).toBeCloseTo(Math.PI / 4);
    expect(fixture.contactRotations[1]).toBeCloseTo(Math.PI / 2);
    expect(fixture.transform.rotation).toBeCloseTo(Math.PI / 2);
    fixture.scene.destroy();
  });

  it('should rotate across zero by the shortest path during substeps', () => {
    /// @case
    /// 1. A position-based kinematic body starts at 350 degrees and targets 10 degrees.
    /// 2. A 1/30-second update advances as two 1/60-second physics substeps.
    /// @expect
    /// The first substep reaches 0 degrees and the second reaches 10 degrees, following the positive 20-degree shortest path.
    const fixture = createContactingPositionBodyFixture({
      initialRotation: toRadians(350),
    });
    fixture.body.setNextKinematicRotation(toRadians(10));

    director.tick(1 / 30);

    expect(fixture.contactRotations[0]).toBeCloseTo(0);
    expect(fixture.contactRotations[1]).toBeCloseTo(toRadians(10));
    expect(fixture.transform.rotation).toBeCloseTo(toRadians(10));
    fixture.scene.destroy();
  });

  it('should accumulate partial engine updates until a fixed substep is due', () => {
    /// @case
    /// 1. A physics scene is configured for 30 fixed steps per second.
    /// 2. The engine advances twice by 1/60 second.
    /// @expect
    /// The first update runs no physics step and the second runs exactly one 1/30-second step.
    const fixture = createMovingBodyFixture({ fps: 30 });

    director.tick(1 / 60);
    expect(fixture.transform.position.x).toBeCloseTo(0);

    director.tick(1 / 60);
    expect(fixture.transform.position.x).toBeCloseTo(0.2);
    fixture.scene.destroy();
  });

  it('should clamp overloaded input while preserving earlier partial time', () => {
    /// @case
    /// 1. A 60-Hz physics scene retains half a step before an overloaded update.
    /// 2. The overloaded update supplies three and a half steps with a two-substep limit.
    /// 3. A final half-step update completes the partial time retained before the overload.
    /// @expect
    /// The overloaded update advances only two steps, drops all excess input, and preserves the earlier half-step for the final update.
    const fixture = createMovingBodyFixture({ maxSubsteps: 2 });

    director.tick(1 / 120);
    expect(fixture.transform.position.x).toBeCloseTo(0);

    director.tick(7 / 120);
    expect(fixture.transform.position.x).toBeCloseTo(0.2);

    director.tick(1 / 120);
    expect(fixture.transform.position.x).toBeCloseTo(0.3);
    fixture.scene.destroy();
  });

  it.each([0, -60, Number.NaN, Number.POSITIVE_INFINITY])('should log and fall back from invalid physics fps %s', (fps) => {
    /// @case A physics scene starts with a non-positive or non-finite configured FPS.
    /// @expect The error is logged and one 1/30-second update emits two contact events at the default 60-Hz setting.
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const fixture = createContactingPositionBodyFixture({ fps });
    try {
      director.tick(1 / 30);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Invalid Physics2DSettings.fps'));
      expect(fixture.contactRotations).toHaveLength(2);
    } finally {
      fixture.scene.destroy();
      error.mockRestore();
    }
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('should log and fall back from invalid maximum substep count %s', (maxSubsteps) => {
    /// @case A physics scene starts with a non-positive, fractional, or non-finite maximum substep count.
    /// @expect The error is logged and an overloaded update is clamped with the default four-substep limit.
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const fixture = createMovingBodyFixture({ maxSubsteps });
    try {
      director.tick(5 / 60);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Invalid Physics2DSettings.maxSubsteps'));
      expect(fixture.transform.position.x).toBeCloseTo(0.4);
    } finally {
      fixture.scene.destroy();
      error.mockRestore();
    }
  });
});

function createMovingBodyFixture({
  fps = 60,
  maxSubsteps = 4,
  bodyType = RigidBody2DType.kinematicVelocityBased,
}: {
  fps?: number;
  maxSubsteps?: number;
  bodyType?: RigidBody2DType;
} = {}) {
  const scene = new Scene('physics-world-2d-fixed-step-test');
  const physicsNode = new Node('physics-world');
  const physicsScene = physicsNode.addComponent(PhysicsWorld2DSceneComponent);
  const settings = new Physics2DSettings();
  settings.fps = fps;
  settings.maxSubsteps = maxSubsteps;
  physicsScene.settings = settings;
  scene.addChild(physicsNode);

  const bodyNode = new Node('moving-body');
  physicsNode.addChild(bodyNode);
  const transform = bodyNode.addComponent(Transform2DComponent);
  const body = bodyNode.addComponent(RigidBody2D);
  body.type = bodyType;
  if (bodyType === RigidBody2DType.kinematicVelocityBased) {
    body.linearVelocity = new Vec2(6, 0);
  }

  director.runSceneImmediate(scene);
  return { scene, physicsScene, transform, body };
}

function createContactingPositionBodyFixture({
  initialRotation = 0,
  fps = 60,
}: {
  initialRotation?: number;
  fps?: number;
} = {}) {
  const scene = new Scene('physics-world-2d-contacting-substeps-test');
  const physicsNode = new Node('physics-world');
  const physicsScene = physicsNode.addComponent(PhysicsWorld2DSceneComponent);
  const settings = new Physics2DSettings();
  settings.fps = fps;
  settings.tags.test = 0;
  settings.collisionMatrix.set(0, 0, true);
  physicsScene.settings = settings;
  scene.addChild(physicsNode);

  const bodyNode = new Node('position-based-body');
  physicsNode.addChild(bodyNode);
  const transform = bodyNode.addComponent(Transform2DComponent);
  transform.rotation = initialRotation;
  const body = bodyNode.addComponent(RigidBody2D);
  body.type = RigidBody2DType.kinematicPositionBased;
  body.tags = ['test'];
  body.collisionWithFixed = true;
  const bodyCollider = bodyNode.addComponent(CircleCollider2D);

  const fixedNode = new Node('fixed-body');
  physicsNode.addChild(fixedNode);
  fixedNode.addComponent(Transform2DComponent);
  const fixedBody = fixedNode.addComponent(RigidBody2D);
  fixedBody.type = RigidBody2DType.fixed;
  fixedBody.tags = ['test'];
  fixedNode.addComponent(CircleCollider2D);

  const contactRotations: number[] = [];
  bodyCollider.onContactBegin.add(() => contactRotations.push(transform.rotation));
  bodyCollider.onContactStay.add(() => contactRotations.push(transform.rotation));

  director.runSceneImmediate(scene);
  return { scene, physicsScene, transform, body, contactRotations };
}
