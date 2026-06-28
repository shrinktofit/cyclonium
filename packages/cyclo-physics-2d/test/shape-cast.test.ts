import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { director, Node, Scene, Vec3 } from 'cc';
import { PhysicsWorld2DSceneComponent } from '@/physics-world-2d-scene-component.js';
import { BoxCollider2D, PolygonCollider2D, RigidBody2D, RigidBody2DType } from '@/index.js';
import { toRadians } from '@cyclonium/core/math/trigonometry';
import type { CircleShapeDesc, RectShapeDesc, CapsuleShapeDesc, ShapeCastQueryOptions, ShapeTransformDesc } from '@/index.js';
import { Vec2 } from '@cyclonium/core/math/vec2';

type CircleShape = CircleShapeDesc & ShapeTransformDesc;
type RectShape = RectShapeDesc & ShapeTransformDesc;
type CapsuleShape = CapsuleShapeDesc & ShapeTransformDesc;

const defaultTickDeltaTime = 1 / 60;

describe('PhysicsWorld2D shape cast', () => {
  let scene: Scene = undefined!;
  let physicsScene: PhysicsWorld2DSceneComponent = undefined!;
  afterAll(() => {
    scene.destroy();
  });
  beforeAll(() => {
    scene = new Scene('test-scene');
    director.runSceneImmediate(scene);
    const node = new Node(`physics-scene`);
    physicsScene = node.addComponent(PhysicsWorld2DSceneComponent);
    scene.addChild(node);
  });

  describe('castCircle', () => {
    it('should cast circle and hit collider', () => {
      const targetNode = new Node('target');
      targetNode.parent = physicsScene.node;
      targetNode.worldPosition = new Vec3(10, 0, 0);
      const collider = targetNode.addComponent(BoxCollider2D);
      collider.width = 2;
      collider.height = 2;
      director.tick(defaultTickDeltaTime);

      const world = physicsScene.physicsWorld;
      const circleDesc: CircleShape = { radius: 1, position: new Vec2(-5, 0) };
      const opts: ShapeCastQueryOptions = {
        direction: new Vec2(1, 0),
        maxDistance: 20,
      };

      const hit = world!.castCircle(circleDesc, opts);
      expect(hit).toBeDefined();
      expect(hit!.collider).toBe(collider);
      targetNode.destroy();
    });

    it('should cast circle in different direction', () => {
      const targetNode = new Node('target');
      targetNode.parent = physicsScene.node;
      targetNode.worldPosition = new Vec3(0, 10, 0);
      targetNode.addComponent(BoxCollider2D);
      director.tick(defaultTickDeltaTime);

      const world = physicsScene.physicsWorld;
      const circleDesc: CircleShape = { radius: 1, position: new Vec2(0, -5) };
      const opts: ShapeCastQueryOptions = {
        direction: new Vec2(0, 1),
        maxDistance: 20,
      };

      const hit = world!.castCircle(circleDesc, opts);
      expect(hit).toBeDefined();
      targetNode.destroy();
    });

    it('should return undefined when no hit', () => {
      const targetNode = new Node('target');
      targetNode.parent = physicsScene.node;
      targetNode.worldPosition = new Vec3(50, 0, 0);
      targetNode.addComponent(BoxCollider2D);
      director.tick(defaultTickDeltaTime);

      const world = physicsScene.physicsWorld;
      const circleDesc: CircleShape = { radius: 1, position: new Vec2(-5, 0) };
      const opts: ShapeCastQueryOptions = {
        direction: new Vec2(1, 0),
        maxDistance: 5,
      };

      const hit = world!.castCircle(circleDesc, opts);
      expect(hit).toBeUndefined();
      targetNode.destroy();
    });

    it('should use targetDistance option', () => {
      const targetNode = new Node('target');
      targetNode.parent = physicsScene.node;
      targetNode.worldPosition = new Vec3(10, 0, 0);
      targetNode.addComponent(BoxCollider2D);
      director.tick(defaultTickDeltaTime);

      const world = physicsScene.physicsWorld;
      const circleDesc: CircleShape = { radius: 1, position: new Vec2(-5, 0) };
      const opts: ShapeCastQueryOptions = {
        direction: new Vec2(1, 0),
        maxDistance: 20,
        targetDistance: 3,
      };

      const hit = world!.castCircle(circleDesc, opts);
      expect(hit).toBeDefined();
      targetNode.destroy();
    });

    it('should use stopAtPenetration option', () => {
      const targetNode = new Node('target');
      targetNode.parent = physicsScene.node;
      targetNode.worldPosition = new Vec3(2, 0, 0);
      targetNode.addComponent(BoxCollider2D);
      targetNode.worldScale = new Vec3(2, 2, 1);
      director.tick(defaultTickDeltaTime);

      const world = physicsScene.physicsWorld;
      const circleDesc: CircleShape = { radius: 1, position: new Vec2(-2, 0) };
      const opts: ShapeCastQueryOptions = {
        direction: new Vec2(1, 0),
        maxDistance: 20,
        stopAtPenetration: true,
      };

      const hit = world!.castCircle(circleDesc, opts);
      expect(hit).toBeDefined();
      targetNode.destroy();
    });

    it('should cast from rotated position', () => {
      const targetNode = new Node('target');
      targetNode.parent = physicsScene.node;
      targetNode.worldPosition = new Vec3(5, 5, 0);
      targetNode.addComponent(BoxCollider2D);
      director.tick(defaultTickDeltaTime);

      const world = physicsScene.physicsWorld;
      const circleDesc: CircleShape = {
        radius: 1,
        position: new Vec2(3.53, 3.53),
        rotation: toRadians(45),
      };
      const opts: ShapeCastQueryOptions = {
        direction: new Vec2(1, 1),
        maxDistance: 10,
      };

      const hit = world!.castCircle(circleDesc, opts);
      expect(hit).toBeDefined();
      targetNode.destroy();
    });

    describe('regression#1 box collider vs. polygon collider', () => {
      // A BoxCollider2D is backed by a solid Rapier Cuboid, while PolygonCollider2D is backed by a Rapier Polyline.
      // Although both fixtures outline the same rectangle, the polyline is only an edge loop. With
      // stopAtPenetration disabled, Rapier may continue from the initial edge penetration to the next edge.

      let targetNode: Node = undefined!;

      beforeEach(() => {
        targetNode = new Node('platform');
        targetNode.parent = physicsScene.node;
        targetNode.worldPosition = new Vec3(0, 0, 0);
        const rigidBody = targetNode.addComponent(RigidBody2D);
        rigidBody.type = RigidBody2DType.fixed;
      });

      afterEach(() => {
        targetNode?.destroy();
      });

      type ExpectedHit = {
        distance: number;
        point: Vec2;
        localPoint1: Vec2;
        localPoint2: Vec2;
        localNormal1: Vec2;
        localNormal2: Vec2;
      };

      const expectShapeCastHit = (expected: ExpectedHit, collider: BoxCollider2D | PolygonCollider2D, stopAtPenetration: boolean) => {
        director.tick(defaultTickDeltaTime);

        const world = physicsScene.physicsWorld;
        const opts: ShapeCastQueryOptions = {
          direction: new Vec2(0, -1),
          maxDistance: 2.7999374999999995,
          stopAtPenetration,
        };

        const hit = world!.castCircle({
          radius: 0.9,
          position: new Vec2(0, 0.8928126535415649),
        }, opts);
        expect(hit).toBeDefined();
        expect(hit!.collider).toBe(collider);
        expect(hit!.distance).toBeCloseTo(expected.distance);
        expect(hit!.point.x).toBeCloseTo(expected.point.x);
        expect(hit!.point.y).toBeCloseTo(expected.point.y);
        expect(hit!.localPoint1.x).toBeCloseTo(expected.localPoint1.x);
        expect(hit!.localPoint1.y).toBeCloseTo(expected.localPoint1.y);
        expect(hit!.localPoint2.x).toBeCloseTo(expected.localPoint2.x);
        expect(hit!.localPoint2.y).toBeCloseTo(expected.localPoint2.y);
        expect(hit!.localNormal1.x).toBeCloseTo(expected.localNormal1.x);
        expect(hit!.localNormal1.y).toBeCloseTo(expected.localNormal1.y);
        expect(hit!.localNormal2.x).toBeCloseTo(expected.localNormal2.x);
        expect(hit!.localNormal2.y).toBeCloseTo(expected.localNormal2.y);
      };

      describe('in case of box collider', () => {
        it.each([true, false])('should produce the same hit when stopAtPenetration is %s', (stopAtPenetration) => {
          const collider = targetNode.addComponent(BoxCollider2D);
          collider.width = 20;
          collider.height = 2;
          expectShapeCastHit({
            distance: 0,
            point: new Vec2(0, 0.8928126535415649),
            localPoint1: new Vec2(0.0002040863037109375, 1),
            localPoint2: new Vec2(0.00020291496184654534, -0.8999999761581421),
            localNormal1: new Vec2(-5.960343330002615e-9, 1),
            localNormal2: new Vec2(5.960343330002615e-9, -1),
          }, collider, stopAtPenetration);
        });
      });

      describe('in case of polygon collider', () => {
        let collider: PolygonCollider2D = undefined!;
        beforeEach(() => {
          collider = targetNode.addComponent(PolygonCollider2D);
          collider.setPolygon([
            new Vec2(10, 1),
            new Vec2(-10, 1),
            new Vec2(-10, -1),
            new Vec2(10, -1),
          ], [0, 1, 1, 2, 2, 3, 3, 0]);
        });

        it('should cast against a polygon when stopAtPenetration is true', () => {
          expectShapeCastHit({
            distance: 0,
            point: new Vec2(0, 0.8928126535415649),
            localPoint1: new Vec2(0.0002040863037109375, 1),
            localPoint2: new Vec2(0.00020291496184654534, 0.8999999165534973),
            localNormal1: new Vec2(-5.960343330002615e-9, -1),
            localNormal2: new Vec2(5.960343330002615e-9, 1),
          }, collider, true);
        });

        it('should cast against a polygon when stopAtPenetration is false', () => {
          expectShapeCastHit({
            distance: 0.9928116798400879,
            point: new Vec2(0, -0.09999902629852297),
            localPoint1: new Vec2(0.0002040863037109375, -0.9999999403953552),
            localPoint2: new Vec2(0.00020291496184654534, -0.8999999761581421),
            localNormal1: new Vec2(-5.960343330002615e-9, 1),
            localNormal2: new Vec2(5.960343330002615e-9, -1),
          }, collider, false);
        });
      });
    });
  });

  describe('castRect', () => {
    it('should cast rect and hit collider', () => {
      const targetNode = new Node('target');
      targetNode.parent = physicsScene.node;
      targetNode.worldPosition = new Vec3(10, 0, 0);
      const collider = targetNode.addComponent(BoxCollider2D);
      collider.width = 2;
      collider.height = 2;
      director.tick(defaultTickDeltaTime);

      const world = physicsScene.physicsWorld;
      const rectDesc: RectShape = { halfExtents: new Vec2(1, 1), position: new Vec2(-5, 0) };
      const opts: ShapeCastQueryOptions = {
        direction: new Vec2(1, 0),
        maxDistance: 20,
      };

      const hit = world!.castRect(rectDesc, opts);
      expect(hit).toBeDefined();
      expect(hit!.collider).toBe(collider);
      targetNode.destroy();
    });

    it('should cast rect with rotation', () => {
      const targetNode = new Node('target');
      targetNode.parent = physicsScene.node;
      targetNode.worldPosition = new Vec3(10, 0, 0);
      targetNode.addComponent(BoxCollider2D);
      director.tick(defaultTickDeltaTime);

      const world = physicsScene.physicsWorld;
      const rectDesc: RectShape = {
        halfExtents: new Vec2(1, 1),
        position: new Vec2(-5, 0),
        rotation: toRadians(45),
      };
      const opts: ShapeCastQueryOptions = {
        direction: new Vec2(1, 0),
        maxDistance: 20,
      };

      const hit = world!.castRect(rectDesc, opts);
      expect(hit).toBeDefined();
      targetNode.destroy();
    });

    it('should return undefined when rect has no hit', () => {
      const targetNode = new Node('target');
      targetNode.parent = physicsScene.node;
      targetNode.worldPosition = new Vec3(50, 0, 0);
      targetNode.addComponent(BoxCollider2D);
      director.tick(defaultTickDeltaTime);

      const world = physicsScene.physicsWorld;
      const rectDesc: RectShape = { halfExtents: new Vec2(1, 1), position: new Vec2(-5, 0) };
      const opts: ShapeCastQueryOptions = {
        direction: new Vec2(1, 0),
        maxDistance: 5,
      };

      const hit = world!.castRect(rectDesc, opts);
      expect(hit).toBeUndefined();
      targetNode.destroy();
    });
  });

  describe('castCapsule', () => {
    it('should cast capsule and hit collider', () => {
      const targetNode = new Node('target');
      targetNode.parent = physicsScene.node;
      targetNode.worldPosition = new Vec3(10, 0, 0);
      const collider = targetNode.addComponent(BoxCollider2D);
      collider.width = 2;
      collider.height = 2;
      director.tick(defaultTickDeltaTime);

      const world = physicsScene.physicsWorld;
      const capsuleDesc: CapsuleShape = { halfHeight: 1, radius: 0.5, position: new Vec2(-5, 0) };
      const opts: ShapeCastQueryOptions = {
        direction: new Vec2(1, 0),
        maxDistance: 20,
      };

      const hit = world!.castCapsule(capsuleDesc, opts);
      expect(hit).toBeDefined();
      expect(hit!.collider).toBe(collider);
      targetNode.destroy();
    });

    it('should cast capsule vertically', () => {
      const targetNode = new Node('target');
      targetNode.parent = physicsScene.node;
      targetNode.worldPosition = new Vec3(0, 10, 0);
      targetNode.addComponent(BoxCollider2D);
      director.tick(defaultTickDeltaTime);

      const world = physicsScene.physicsWorld;
      const capsuleDesc: CapsuleShape = { halfHeight: 1, radius: 0.5, position: new Vec2(0, -5) };
      const opts: ShapeCastQueryOptions = {
        direction: new Vec2(0, 1),
        maxDistance: 20,
      };

      const hit = world!.castCapsule(capsuleDesc, opts);
      expect(hit).toBeDefined();
      targetNode.destroy();
    });

    it('should return undefined when capsule has no hit', () => {
      const targetNode = new Node('target');
      targetNode.parent = physicsScene.node;
      targetNode.worldPosition = new Vec3(50, 0, 0);
      targetNode.addComponent(BoxCollider2D);
      director.tick(defaultTickDeltaTime);

      const world = physicsScene.physicsWorld;
      const capsuleDesc: CapsuleShape = { halfHeight: 1, radius: 0.5, position: new Vec2(-5, 0) };
      const opts: ShapeCastQueryOptions = {
        direction: new Vec2(1, 0),
        maxDistance: 5,
      };

      const hit = world!.castCapsule(capsuleDesc, opts);
      expect(hit).toBeUndefined();
      targetNode.destroy();
    });
  });

  describe('hit properties', () => {
    it('should return point property', () => {
      const targetNode = new Node('target');
      targetNode.parent = physicsScene.node;
      targetNode.worldPosition = new Vec3(5, 0, 0);
      targetNode.addComponent(BoxCollider2D);
      director.tick(defaultTickDeltaTime);

      const world = physicsScene.physicsWorld;
      const circleDesc: CircleShape = { radius: 1, position: new Vec2(-5, 0) };
      const opts: ShapeCastQueryOptions = {
        direction: new Vec2(1, 0),
        maxDistance: 20,
      };

      const hit = world!.castCircle(circleDesc, opts);
      expect(hit).toBeDefined();
      expect(hit!.point).toBeDefined();
      expect(typeof hit!.point.x).toBe('number');
      expect(typeof hit!.point.y).toBe('number');
      targetNode.destroy();
    });

    it('should return distance property', () => {
      const targetNode = new Node('target');
      targetNode.parent = physicsScene.node;
      targetNode.worldPosition = new Vec3(5, 0, 0);
      targetNode.addComponent(BoxCollider2D);
      director.tick(defaultTickDeltaTime);

      const world = physicsScene.physicsWorld;
      const circleDesc: CircleShape = { radius: 1, position: new Vec2(-5, 0) };
      const opts: ShapeCastQueryOptions = {
        direction: new Vec2(1, 0),
        maxDistance: 20,
      };

      const hit = world!.castCircle(circleDesc, opts);
      expect(hit).toBeDefined();
      expect(typeof hit!.distance).toBe('number');
      expect(hit!.distance).toBeGreaterThan(0);
      targetNode.destroy();
    });
  });
});
