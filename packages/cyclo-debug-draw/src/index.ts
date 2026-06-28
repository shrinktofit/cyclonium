import { Camera, Color, GeometryRenderer, Mat4, Quat, Vec3, director, find, geometry, renderer } from 'cc';
import { EDITOR_NOT_IN_PREVIEW } from 'cc/env';
import { CycloComponent } from '@cyclonium/core/framework';
import { cycloBuiltinClass } from '@cyclonium/core/internal';
import { requiresComponent } from '@cyclonium/core/legacy-decorator';
import { toDegrees } from '@cyclonium/core/math/trigonometry';
import type { Vec2 } from '@cyclonium/core/math/vec2';

@cycloBuiltinClass('DebugDrawTarget')
export class DebugDrawTarget extends CycloComponent {
  get geometryRenderer() {
    return tryGetDebugGeometryRenderer(this._camera);
  }

  @requiresComponent(Camera)
  private get _camera(): Camera { return undefined!; }
}

export function tryGetDebugGeometryRenderer(camera?: Camera): GeometryRenderer | null | undefined {
  let renderCamera: renderer.scene.Camera | undefined = undefined;
  if (camera) {
    renderCamera = camera.camera;
  } else if (EDITOR_NOT_IN_PREVIEW) {
    renderCamera = (globalThis as any).cce?.Camera.camera.camera as renderer.scene.Camera;
  } else {
    renderCamera = find('World/Main Camera')?.getComponent(Camera)?.camera;
  }
  if (!renderCamera) {
    return;
  }

  if (renderCamera) {
    renderCamera.initGeometryRenderer();
  }

  const geometryRenderer = renderCamera?.geometryRenderer ?? director.root?.pipeline.geometryRenderer;
  return geometryRenderer;
}

export function getDebugGeometryRenderer() {
  const geometryRenderer = tryGetDebugGeometryRenderer();
  if (!geometryRenderer) {
    throw new Error(`Can not get debug geometry renderer.`);
  }
  return geometryRenderer;
}

function getGeometryRendererFromCamera(camera: Camera) {
  const renderCamera = camera.camera;
  if (!renderCamera) {
    return undefined;
  }
  renderCamera.initGeometryRenderer();
  const geometryRenderer = renderCamera.geometryRenderer;
  if (!geometryRenderer) {
    return undefined;
  }
  return geometryRenderer;
}

const cacheAABB = new geometry.AABB();

export class DebugDrawContext {
  static fromEditorCamera() {
    const camera = (globalThis as any).cce?.Camera.camera as Camera;
    if (!camera) {
      return undefined;
    }
    const geometryRenderer = getGeometryRendererFromCamera(camera);
    if (!geometryRenderer) {
      return undefined;
    }
    return new DebugDrawContext([geometryRenderer]);
  }

  static fromDebugDrawTarget(target: DebugDrawTarget) {
    return this.fromDebugDrawTargets([target]);
  }

  static fromDebugDrawTargets(target: DebugDrawTarget[]) {
    const geometryRenderers = target.map((t) => t.geometryRenderer).filter((r) => r !== undefined) as GeometryRenderer[];
    return new DebugDrawContext(geometryRenderers);
  }

  constructor(geometryRenderers: GeometryRenderer[]) {
    this._geometryRenderers = geometryRenderers;
  }

  get geometryRenderers_internal() {
    return this._geometryRenderers;
  }

  rect(opts: {
    center: Readonly<Vec3>;
    halfExtent: Readonly<Vec2> | number;
    right?: Readonly<Vec3>;
    up?: Readonly<Vec3>;
    color?: Readonly<Color>;
    wireframe?: boolean;
    depthTest?: boolean;
    unlit?: boolean;
    transform?: Readonly<Mat4>;
  }) {
    const {
      center,
      halfExtent,
      right = Vec3.RIGHT,
      up = Vec3.UP,
      color,
      unlit,
      wireframe,
      depthTest,
      transform,
    } = opts;
    const hx = typeof halfExtent === 'number' ? halfExtent : halfExtent.x;
    const hy = typeof halfExtent === 'number' ? halfExtent : halfExtent.y;
    let iVec3Cache = 0;
    const v1 = Vec3.scaleAndAdd(vec3Caches[iVec3Cache++], center, right, hx);
    Vec3.scaleAndAdd(v1, v1, up, hy);
    const v2 = Vec3.scaleAndAdd(vec3Caches[iVec3Cache++], center, up, hy);
    Vec3.scaleAndAdd(v2, v2, right, -hx);
    const v3 = Vec3.scaleAndAdd(vec3Caches[iVec3Cache++], center, up, -hy);
    Vec3.scaleAndAdd(v3, v3, right, -hx);
    const v4 = Vec3.scaleAndAdd(vec3Caches[iVec3Cache++], center, right, hx);
    Vec3.scaleAndAdd(v4, v4, up, -hy);
    if (transform) {
      Vec3.transformMat4(v1, v1, transform);
      Vec3.transformMat4(v2, v2, transform);
      Vec3.transformMat4(v3, v3, transform);
      Vec3.transformMat4(v4, v4, transform);
    }
    this._geometryRenderers.forEach((g) => {
      g.addQuad(v1, v2, v3, v4, color ?? Color.BLACK, wireframe, depthTest, unlit);
    });
  }

  cube(opts: {
    center: Readonly<Vec3>;
    halfExtent: Readonly<Vec3> | number;
    color?: Readonly<Color>;
    wireframe?: boolean;
    depthTest?: boolean;
    transform?: Readonly<Mat4>;
  }) {
    const {
      center,
      halfExtent,
      color,
      wireframe,
      depthTest,
      transform,
    } = opts;
    const hx = typeof halfExtent === 'number' ? halfExtent : halfExtent.x;
    const hy = typeof halfExtent === 'number' ? halfExtent : halfExtent.y;
    const hz = typeof halfExtent === 'number' ? halfExtent : halfExtent.z;
    this._geometryRenderers.forEach((g) => {
      g.addBoundingBox(
        geometry.AABB.set(cacheAABB, center.x, center.y, center.z, hx, hy, hz),
        color ?? Color.BLACK,
        wireframe,
        depthTest,
        undefined,
        transform ? true : false,
        transform,
      );
    });
    return this;
  }

  lineFromTo(opts: {
    from: Readonly<Vec3>;
    to: Readonly<Vec3>;
    color?: Readonly<Color>;
    depthTest?: boolean;
  }) {
    const {
      from,
      to,
      color = Color.BLACK,
      depthTest,
    } = opts;
    this._geometryRenderers.forEach((g) => {
      g.addLine(from, to, color, depthTest);
    });
    return this;
  }

  lineFromDirLength(opts: {
    from: Readonly<Vec3>;
    dir: Readonly<Vec3>;
    length: number;
    color?: Readonly<Color>;
    depthTest?: boolean;
  }) {
    const {
      from,
      dir,
      length,
      color = Color.BLACK,
      depthTest,
    } = opts;
    this._geometryRenderers.forEach((g) => {
      g.addLine(from, Vec3.add(new Vec3(), from, Vec3.multiplyScalar(new Vec3(), dir, length)), color, depthTest);
    });
    return this;
  }

  sphere(opts: {
    center: Readonly<Vec3>;
    radius: number;
    color?: Readonly<Color>;
    wireframe?: boolean;
    depthTest?: boolean;
    segments?: number;
  }) {
    const {
      center,
      radius,
      color = Color.BLACK,
      wireframe,
      depthTest,
      segments = 16,
    } = opts;
    this._geometryRenderers.forEach((g) => {
      g.addSphere(center, radius, color, segments, segments, wireframe, depthTest);
    });
    return this;
  }

  capsule(opts: {
    center: Readonly<Vec3>;
    radius: number;
    height: number;
    color?: Readonly<Color>;
    wireframe?: boolean;
    depthTest?: boolean;
    segments?: number;
    transform?: {
      position?: Readonly<Vec3>;
      rotation?: Readonly<Quat>;
      scale?: Readonly<Vec3>;
    };
  }) {
    const {
      center,
      radius,
      height,
      color = Color.BLACK,
      wireframe,
      depthTest,
      segments = 16,
      transform,
    } = opts;
    let transformMatrix: Mat4 | undefined = undefined;
    if (transform) {
      if (transform instanceof Mat4) {
        transformMatrix = transform;
      } else {
        const { position, rotation, scale } = transform;
        transformMatrix = Mat4.fromSRT(new Mat4(), rotation ?? Quat.IDENTITY, position ?? Vec3.ZERO, scale ?? Vec3.ONE);
      }
    }
    this._geometryRenderers.forEach((g) => {
      g.addCapsule(center, radius, height, color, segments, segments, wireframe, depthTest, undefined, !!transformMatrix, transformMatrix);
    });
    return this;
  }

  circle(opts: {
    center: Readonly<Vec3>;
    radius: number;
    normal?: Readonly<Vec3>;
    color?: Readonly<Color>;
    wireframe?: boolean;
    depthTest?: boolean;
    segments?: number;
    transform?: Mat4;
  }) {
    return this.arc({
      ...opts,
      startAngle: 0,
      endAngle: Math.PI * 2,
    });
  }

  arc(opts: {
    center: Readonly<Vec3>;
    radius: number;
    startAngle: number;
    endAngle: number;
    normal?: Readonly<Vec3>;
    color?: Readonly<Color>;
    wireframe?: boolean;
    depthTest?: boolean;
    segments?: number;
    transform?: Mat4;
  }) {
    const {
      center,
      radius,
      startAngle,
      endAngle,
      normal = Vec3.UNIT_Y,
      color = Color.BLACK,
      wireframe,
      depthTest,
      segments = 64,
      transform,
    } = opts;
    const finalTransform = new Mat4();
    Mat4.fromSRT(
      finalTransform,
      Quat.rotationTo(new Quat(), Vec3.UNIT_Y, normal),
      center,
      Vec3.ONE,
    );
    if (transform) {
      Mat4.multiply(finalTransform, transform, finalTransform);
    }
    this._geometryRenderers.forEach((g) => {
      g.addArc(Vec3.ZERO, radius, color, toDegrees(startAngle), toDegrees(endAngle), segments, depthTest, true, finalTransform);
    });
  }

  sector(opts: {
    center: Readonly<Vec3>;
    radius: number;
    halfVector?: Readonly<Vec3>;
    halfAngle?: number;
    normal?: Readonly<Vec3>;
    color?: Readonly<Color>;
    wireframe?: boolean;
    depthTest?: boolean;
    segments?: number;
    transform?: Mat4;
    unlit?: boolean;
  }) {
    let iCacheMat4 = 0;
    let iCacheQuat = 0;
    let iCacheVec3 = 0;

    const {
      center,
      radius,
      halfVector = Vec3.UNIT_Z,
      halfAngle = Math.PI / 2,
      normal = Vec3.UNIT_Y,
      color = Color.BLACK,
      wireframe = false,
      depthTest,
      segments = 64,
      transform,
      unlit = false,
    } = opts;

    const finalTransform = Mat4.identity(mat4Caches[iCacheMat4++]);

    // Scale
    Mat4.scale(finalTransform, finalTransform, Vec3.multiplyScalar(vec3Caches[iCacheVec3++], Vec3.ONE, radius));

    // Rotate
    {
      const inputHalfVector = Vec3.normalize(vec3Caches[iCacheVec3++], halfVector);
      const inputNormal = Vec3.normalize(vec3Caches[iCacheVec3++], normal);
      const cross = Vec3.cross(vec3Caches[iCacheVec3++], inputHalfVector, inputNormal).normalize();
      const newY = Vec3.cross(vec3Caches[iCacheVec3++], cross, inputHalfVector).normalize();
      const newX = Vec3.transformQuat(vec3Caches[iCacheVec3++], inputHalfVector, Quat.fromAxisAngle(quatCaches[iCacheQuat++], newY, halfAngle));
      const newZ = Vec3.cross(vec3Caches[iCacheVec3++], newX, newY).normalize();
      const newMat4 = mat4FromAxes(mat4Caches[iCacheMat4++], newX, newY, newZ);

      Mat4.multiply(finalTransform, newMat4, finalTransform);
    }

    // Translate
    Mat4.translate(finalTransform, finalTransform, center);

    // User defined transform
    if (transform) {
      Mat4.multiply(finalTransform, transform, finalTransform);
    }

    const startAngle = 0;
    const endAngle = startAngle + halfAngle * 2;
    this._geometryRenderers.forEach((g) => {
      g.addSector(
        Vec3.ZERO,
        1.0,
        color,
        toDegrees(startAngle),
        toDegrees(endAngle),
        segments,
        wireframe,
        depthTest,
        unlit,
        true,
        finalTransform,
      );
    });
  }

  private _geometryRenderers: GeometryRenderer[];
}

function mat4FromAxes(mat4: Mat4, xAxis: Vec3, yAxis: Vec3, zAxis: Vec3) {
  return Mat4.set(mat4,
    xAxis.x,
    xAxis.y,
    xAxis.z,
    0,
    yAxis.x,
    yAxis.y,
    yAxis.z,
    0,
    zAxis.x,
    zAxis.y,
    zAxis.z,
    0,
    0,
    0,
    0,
    1,
  );
}

export * from './legacy.js';

const vec3Caches = Array.from({ length: 10 }, () => new Vec3());
const mat4Caches = Array.from({ length: 10 }, () => new Mat4());
const quatCaches = Array.from({ length: 10 }, () => new Quat());
