import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { director, Node, Scene, Vec3 } from 'cc';
import { Vec2 } from '@cyclonium/core/math/vec2';
import {
  BoxCollider2D,
  BoxSceneQueryProbe2D,
  CapsuleSceneQueryProbe2D,
  CircleSceneQueryProbe2D,
  Physics2DSettings,
  PhysicsWorld2DSceneComponent,
  RigidBody2D,
  RigidBody2DType,
} from '@/index.js';

const defaultTickDeltaTime = 1 / 60;
let physicsScene: PhysicsWorld2DSceneComponent = undefined!;
const createdNodes: Node[] = [];

describe('SceneQueryProbe2D', () => {
  let scene: Scene = undefined!;

  beforeAll(() => {
    scene = new Scene('scene-query-probe-test');
    director.runSceneImmediate(scene);
    const node = new Node('physics-scene');
    physicsScene = node.addComponent(PhysicsWorld2DSceneComponent);
    physicsScene.settings = createSettings();
    scene.addChild(node);
  });

  afterAll(() => {
    scene.destroy();
  });

  afterEach(() => {
    for (const node of createdNodes.splice(0)) {
      if (node.isValid) {
        node.destroy();
      }
    }
    director.tick(defaultTickDeltaTime);
  });

  it('should intersect circle probe with matching target tag', () => {
    /// @case A circle probe overlaps two colliders but filters for one target tag.
    /// @expect Only the collider whose rigid body has the requested tag is returned.
    const enemy = createBoxTarget('enemy', 'enemy', new Vec2(0, 0));
    const ally = createBoxTarget('ally', 'ally', new Vec2(0, 0));
    const probeNode = createProbeNode('circle-probe', new Vec2(0, 0));
    const probe = probeNode.addComponent(CircleSceneQueryProbe2D);
    probe.radius = 2;
    probe.targetTags = ['enemy'];
    director.tick(defaultTickDeltaTime);

    expect(probe.intersect()).toEqual([enemy.collider]);

    enemy.node.destroy();
    ally.node.destroy();
    probeNode.destroy();
  });

  it('should respect body type filter flags', () => {
    /// @case A box probe overlaps a fixed target while fixed body queries are disabled.
    /// @expect The disabled body type is excluded until the fixed flag is enabled.
    const target = createBoxTarget('fixed-target', 'enemy', new Vec2(0, 0), RigidBody2DType.fixed);
    const probeNode = createProbeNode('box-probe', new Vec2(0, 0));
    const probe = probeNode.addComponent(BoxSceneQueryProbe2D);
    probe.halfExtents = new Vec2(2, 2);
    probe.targetTags = ['enemy'];
    probe.fixed = false;
    director.tick(defaultTickDeltaTime);

    expect(probe.intersect()).toEqual([]);

    probe.fixed = true;
    expect(probe.intersect()).toEqual([target.collider]);

    target.node.destroy();
    probeNode.destroy();
  });

  it('should rebuild cached filter after target tags are reassigned', () => {
    /// @case A cached probe filter was built for one tag, then targetTags is assigned to a new tag list.
    /// @expect The next query observes the new tags instead of reusing stale filter group bits.
    const enemy = createBoxTarget('mutable-enemy', 'enemy', new Vec2(0, 0));
    const ally = createBoxTarget('mutable-ally', 'ally', new Vec2(0, 0));
    const probeNode = createProbeNode('mutable-tags-probe', new Vec2(0, 0));
    const probe = probeNode.addComponent(CircleSceneQueryProbe2D);
    probe.radius = 2;
    probe.targetTags = ['enemy'];
    director.tick(defaultTickDeltaTime);

    expect(probe.intersect()).toEqual([enemy.collider]);

    probe.targetTags = ['ally'];

    expect(probe.intersect()).toEqual([ally.collider]);

    enemy.node.destroy();
    ally.node.destroy();
    probeNode.destroy();
  });

  it('should sweep box probe and return the nearest hit', () => {
    /// @case A box probe sweeps toward two matching colliders at different distances.
    /// @expect The nearest collider is returned with a positive hit distance.
    const near = createBoxTarget('near-target', 'enemy', new Vec2(5, 0));
    const far = createBoxTarget('far-target', 'enemy', new Vec2(10, 0));
    const probeNode = createProbeNode('box-sweep-probe', new Vec2(0, 0));
    const probe = probeNode.addComponent(BoxSceneQueryProbe2D);
    probe.halfExtents = new Vec2(1, 1);
    probe.targetTags = ['enemy'];
    director.tick(defaultTickDeltaTime);

    const hit = probe.sweep(new Vec2(1, 0), 20);

    expect(hit).toBeDefined();
    expect(hit!.collider).toBe(near.collider);
    expect(hit!.distance).toBeGreaterThan(0);

    near.node.destroy();
    far.node.destroy();
    probeNode.destroy();
  });

  it('should keep sweep hit point stable after probe transform changes', () => {
    /// @case A sweep hit is queried, then the probe node moves and performs another query.
    /// @expect The previous hit point remains based on the original sweep start.
    const target = createBoxTarget('stable-hit-point-target', 'enemy', new Vec2(5, 0));
    const probeNode = createProbeNode('stable-hit-point-probe', new Vec2(0, 0));
    const probe = probeNode.addComponent(BoxSceneQueryProbe2D);
    probe.halfExtents = new Vec2(1, 1);
    probe.targetTags = ['enemy'];
    director.tick(defaultTickDeltaTime);

    const hit = probe.sweep(new Vec2(1, 0), 20);

    expect(hit).toBeDefined();
    const pointBeforeMove = hit!.point;

    probeNode.worldPosition = new Vec3(100, 0, 0);
    director.tick(defaultTickDeltaTime);
    void probe.sweep(new Vec2(1, 0), 20);

    expect(hit!.point.x).toBeCloseTo(pointBeforeMove.x);
    expect(hit!.point.y).toBeCloseTo(pointBeforeMove.y);

    target.node.destroy();
    probeNode.destroy();
  });

  it('should sweep box probe from explicit transform', () => {
    /// @case A box probe node is not located at the desired sweep start.
    /// @expect sweepFrom uses the supplied transform instead of the probe node transform.
    const target = createBoxTarget('explicit-transform-target', 'enemy', new Vec2(5, 0));
    const probeNode = createProbeNode('explicit-transform-probe', new Vec2(100, 0));
    const probe = probeNode.addComponent(BoxSceneQueryProbe2D);
    probe.halfExtents = new Vec2(1, 1);
    probe.targetTags = ['enemy'];
    director.tick(defaultTickDeltaTime);

    expect(probe.sweep(new Vec2(1, 0), 20)).toBeUndefined();

    const hit = probe.sweepFrom({ position: new Vec2(0, 0) }, new Vec2(1, 0), 20);

    expect(hit).toBeDefined();
    expect(hit!.collider).toBe(target.collider);

    target.node.destroy();
    probeNode.destroy();
  });

  it('should skip excluded colliders during sweep', () => {
    /// @case The nearest matching collider is excluded from a sweep.
    /// @expect The sweep returns the next matching collider instead of being blocked.
    const near = createBoxTarget('excluded-near-target', 'enemy', new Vec2(5, 0));
    const far = createBoxTarget('excluded-far-target', 'enemy', new Vec2(10, 0));
    const probeNode = createProbeNode('exclude-collider-probe', new Vec2(0, 0));
    const probe = probeNode.addComponent(BoxSceneQueryProbe2D);
    probe.halfExtents = new Vec2(1, 1);
    probe.targetTags = ['enemy'];
    director.tick(defaultTickDeltaTime);

    const hit = probe.sweep(new Vec2(1, 0), 20, {
      excludeColliders: [near.collider],
    });

    expect(hit).toBeDefined();
    expect(hit!.collider).toBe(far.collider);

    near.node.destroy();
    far.node.destroy();
    probeNode.destroy();
  });

  it('should sweep capsule probe', () => {
    /// @case A capsule probe sweeps toward a matching collider.
    /// @expect The capsule query uses the same target tag filter and reports the collider.
    const target = createBoxTarget('capsule-target', 'enemy', new Vec2(5, 0));
    const probeNode = createProbeNode('capsule-probe', new Vec2(0, 0));
    const probe = probeNode.addComponent(CapsuleSceneQueryProbe2D);
    probe.halfHeight = 1;
    probe.radius = 0.5;
    probe.targetTags = ['enemy'];
    director.tick(defaultTickDeltaTime);

    const hit = probe.sweep(new Vec2(1, 0), 20);

    expect(hit).toBeDefined();
    expect(hit!.collider).toBe(target.collider);

    target.node.destroy();
    probeNode.destroy();
  });

  it('should return empty results without a physics world', () => {
    /// @case A probe exists in a scene without PhysicsWorld2DSceneComponent.
    /// @expect Queries fail closed without throwing.
    const sceneWithoutWorld = new Scene('scene-query-probe-without-world');
    const probeNode = new Node('probe-without-world');
    sceneWithoutWorld.addChild(probeNode);
    const probe = probeNode.addComponent(CircleSceneQueryProbe2D);

    expect(probe.intersect()).toEqual([]);
    expect(probe.sweep(new Vec2(1, 0), 10)).toBeUndefined();

    sceneWithoutWorld.destroy();
  });

  it('should throw for unknown target tag', () => {
    /// @case A probe references a tag missing from Physics2DSettings.
    /// @expect The world tag lookup error is surfaced to the caller.
    const probeNode = createProbeNode('unknown-tag-probe', new Vec2(0, 0));
    const probe = probeNode.addComponent(CircleSceneQueryProbe2D);
    probe.targetTags = ['missing'];
    director.tick(defaultTickDeltaTime);

    expect(() => probe.intersect()).toThrow('Tag missing not found.');

    probeNode.destroy();
  });
});

function createSettings() {
  const settings = new Physics2DSettings();
  const settingsWithTags = settings as unknown as { _tags: Record<string, number> };
  settingsWithTags._tags = { enemy: 0, ally: 1 };
  settings.collisionMatrix.set(0, 0, true);
  settings.collisionMatrix.set(0, 1, true);
  settings.collisionMatrix.set(1, 1, true);
  return settings;
}

function createBoxTarget(name: string, tag: string, position: Vec2, type = RigidBody2DType.fixed) {
  const node = new Node(name);
  createdNodes.push(node);
  node.parent = physicsScene.node;
  node.worldPosition = new Vec3(position.x, position.y, 0);
  const body = node.addComponent(RigidBody2D);
  body.type = type;
  body.tags = [tag];
  const collider = node.addComponent(BoxCollider2D);
  collider.width = 2;
  collider.height = 2;
  return { node, collider };
}

function createProbeNode(name: string, position: Vec2) {
  const node = new Node(name);
  createdNodes.push(node);
  node.parent = physicsScene.node;
  node.worldPosition = new Vec3(position.x, position.y, 0);
  return node;
}
