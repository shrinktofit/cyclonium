import { Color } from 'cc';
import { EDITOR_NOT_IN_PREVIEW } from 'cc/env';
import { tryGetDebugGeometryRenderer, drawBox2D, drawCircle2D, drawLineFromTo2D } from '@cyclonium/debug-draw';
import { Vec2 } from '@cyclonium/core/math/vec2';
import { Transform2DComponent } from '@cyclonium/core/2d';
import type { BoxCollider2D } from './colliders/box-collider-2d.js';
import type { CircleCollider2D } from './colliders/circle-collider-2d.js';
import type { CapsuleCollider2D } from './colliders/capsule-collider-2d.js';
import type { BoxSceneQueryProbe2D } from './scene-query-probes/box-scene-query-probe-2d.js';
import type { CapsuleSceneQueryProbe2D } from './scene-query-probes/capsule-scene-query-probe-2d.js';
import type { CircleSceneQueryProbe2D } from './scene-query-probes/circle-scene-query-probe-2d.js';
import type { SceneQueryProbe2D } from './scene-query-probe-2d.js';

const depthTest = false;
const color = Color.YELLOW;
const probeColor = new Color(0, 204, 255, 255);
const wireframe = true;

export function drawBoxCollider2DGizmo(collider: BoxCollider2D) {
  if (EDITOR_NOT_IN_PREVIEW) {
    const g = tryGetDebugGeometryRenderer();
    if (g) {
      const transform = getCollider2DTransform(collider);
      drawBox2D(g, collider.center, new Vec2(collider.width / 2, collider.height / 2), color, {
        wireframe,
        depthTest,
        transform,
      });
      drawLineFromTo2D(g, collider.center, collider.center.addMulScalar(Vec2.UNIT_X, collider.width / 2), Color.RED, {
        depthTest,
        transform,
      });
      drawLineFromTo2D(g, collider.center, collider.center.addMulScalar(Vec2.UNIT_Y, collider.height / 2), Color.GREEN, {
        depthTest,
        transform,
      });
    }
  }
}

export function drawCircleCollider2DGizmo(collider: CircleCollider2D) {
  if (EDITOR_NOT_IN_PREVIEW) {
    const g = tryGetDebugGeometryRenderer();
    if (g) {
      const transform = Transform2DComponent.of(collider);
      drawCircle2D(g, {
        center: collider.center,
        radius: collider.radius * transform.scale.x,
        color: color,
        wireframe,
        depthTest,
        transform: getCollider2DTransform(collider),
      });
    }
  }
}

export function drawCapsuleCollider2DGizmo(_collider: CapsuleCollider2D) {
  if (EDITOR_NOT_IN_PREVIEW) {
    const g = tryGetDebugGeometryRenderer();
    if (g) {
      // todo
    }
  }
}

export function drawBoxSceneQueryProbe2DGizmo(probe: BoxSceneQueryProbe2D) {
  if (EDITOR_NOT_IN_PREVIEW) {
    const g = tryGetDebugGeometryRenderer();
    if (g) {
      drawBox2D(g, Vec2.ZERO, probe.halfExtents, probeColor, {
        wireframe,
        depthTest,
        transform: getSceneQueryProbe2DTransform(probe),
      });
    }
  }
}

export function drawCircleSceneQueryProbe2DGizmo(probe: CircleSceneQueryProbe2D) {
  if (EDITOR_NOT_IN_PREVIEW) {
    const g = tryGetDebugGeometryRenderer();
    if (g) {
      drawCircle2D(g, {
        center: Vec2.ZERO.clone(),
        radius: probe.radius,
        color: probeColor,
        wireframe,
        depthTest,
        transform: getSceneQueryProbe2DTransform(probe),
      });
    }
  }
}

export function drawCapsuleSceneQueryProbe2DGizmo(probe: CapsuleSceneQueryProbe2D) {
  if (EDITOR_NOT_IN_PREVIEW) {
    const g = tryGetDebugGeometryRenderer();
    if (g) {
      const transform = getSceneQueryProbe2DTransform(probe);
      const top = new Vec2(0, probe.halfHeight);
      const bottom = new Vec2(0, -probe.halfHeight);
      drawCircle2D(g, {
        center: top,
        radius: probe.radius,
        color: probeColor,
        wireframe,
        depthTest,
        transform,
      });
      drawCircle2D(g, {
        center: bottom,
        radius: probe.radius,
        color: probeColor,
        wireframe,
        depthTest,
        transform,
      });
      drawLineFromTo2D(g, new Vec2(-probe.radius, -probe.halfHeight), new Vec2(-probe.radius, probe.halfHeight), probeColor, {
        depthTest,
        transform,
      });
      drawLineFromTo2D(g, new Vec2(probe.radius, -probe.halfHeight), new Vec2(probe.radius, probe.halfHeight), probeColor, {
        depthTest,
        transform,
      });
    }
  }
}

function getCollider2DTransform(collider: BoxCollider2D | CircleCollider2D) {
  return Transform2DComponent.of(collider).matrix;
}

function getSceneQueryProbe2DTransform(probe: SceneQueryProbe2D) {
  return Transform2DComponent.of(probe).matrix;
}
