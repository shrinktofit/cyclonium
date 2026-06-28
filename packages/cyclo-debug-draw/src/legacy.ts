import { Mat3 } from "@cyclonium/core/math/mat3";
import { decomposeSRTMat3 } from "@cyclonium/core/math/transform-2d";
import { Vec2 } from "@cyclonium/core/math/vec2";
import { Mat4, Quat, type GeometryRenderer, type Color, Vec3 } from "cc";

export const drawBox2D = (() => {
  return (
    geometryRenderer: GeometryRenderer,
    center: Readonly<Vec2>,
    halfExtent: Readonly<Vec2> | number,
    color: Readonly<Color>,
    {
      wireframe = true,
      depthTest = true,
      z = 0,
      transform,
    }: {
      wireframe?: boolean;
      depthTest?: boolean;
      z?: number;
      transform?: Mat3;
    } = {},
  ) => {
    const hx = typeof halfExtent === 'number' ? halfExtent : halfExtent.x;
    const hy = typeof halfExtent === 'number' ? halfExtent : halfExtent.y;
    const v0 = new Vec2(center.x + hx, center.y + hy);
    const v1 = new Vec2(center.x - hx, center.y + hy);
    const v2 = new Vec2(center.x - hx, center.y - hy);
    const v3 = new Vec2(center.x + hx, center.y - hy);
    if (transform) {
      transform.transformVec2(v0, v0);
      transform.transformVec2(v1, v1);
      transform.transformVec2(v2, v2);
      transform.transformVec2(v3, v3);
    }
    geometryRenderer.addQuad(
      new Vec3(v0.x, v0.y, z),
      new Vec3(v1.x, v1.y, z),
      new Vec3(v2.x, v2.y, z),
      new Vec3(v3.x, v3.y, z),
      color,
      wireframe,
      depthTest,
    );
  };
})();

export const drawCircleXY = (() => {
  const transform = Mat4.fromQuat(new Mat4(), Quat.fromAxisAngle(new Quat(), Vec3.UNIT_X, Math.PI / 2));
  return (
    geometryRenderer: GeometryRenderer,
    center: Readonly<Vec3>,
    radius: number,
    color: Readonly<Color>,
    {
      wireframe = true,
      depthTest = true,
      segments = 32,
    }: {
      wireframe?: boolean;
      depthTest?: boolean;
      segments?: number;
    } = {},
  ) => {
    geometryRenderer.addCircle(
      center,
      radius,
      color,
      segments,
      depthTest,
      true,
      transform,
    );
  };
})();

export const drawLineFromTo2D = (() => {
  const from3 = new Vec3();
  const to3 = new Vec3();
  const transform2To3 = (v: Vec2, out: Vec3) => {
    Vec3.set(out, v.x, v.y, 0);
    return out;
  };
  const transformMat4 = (v: Vec2, out: Vec3, transform: Mat4) => {
    transform2To3(v, out);
    Vec3.transformMat4(out, out, transform);
    return out;
  };
  const transformMat3 = (v: Vec2, out: Vec3, transform: Mat3) => {
    const v2 = new Vec2(v.x, v.y);
    transform.transformVec2(v, v2);
    transform2To3(v2, out);
    return out;
  };
  return (
    geometryRenderer: GeometryRenderer,
    from: Readonly<Vec2>,
    to: Readonly<Vec2>,
    color: Readonly<Color>,
    {
      depthTest = true,
      transform,
    }: {
      depthTest?: boolean;
      transform?: Mat3 | Mat4;
    } = {},
  ) => {
    if (transform instanceof Mat3) {
      transformMat3(from, from3, transform);
      transformMat3(to, to3, transform);
    } else if (transform instanceof Mat4) {
      transformMat4(from, from3, transform);
      transformMat4(to, to3, transform);
    } else {
      transform2To3(from, from3);
      transform2To3(to, to3);
    }
    geometryRenderer.addLine(from3, to3, color, depthTest);
  };
})();

export const drawCircle2D = (() => {
  const rotation2To3 = Quat.fromAxisAngle(new Quat(), Vec3.UNIT_X, Math.PI / 2);
  return (
    geometryRenderer: GeometryRenderer,
    {
      center,
      radius,
      color,
      segments = 32,
      wireframe = true,
      depthTest = true,
      z = 0,
      transform,
    }: {
      center: Vec2;
      radius: number;
      color: Color;
      segments?: number;
      wireframe?: boolean;
      depthTest?: boolean;
      z?: number;
      transform?: Mat3;
    },
  ) => {
    const center3 = new Vec3(center.x, center.y, z);
    const transformMatrix = Mat4.fromSRTOrigin(
      new Mat4(),
      rotation2To3,
      Vec3.ZERO,
      Vec3.ONE,
      center3,
    );
    if (transform) {
      const srt = decomposeSRTMat3(transform);
      const transform4 = Mat4.fromSRT(
        new Mat4(),
        Quat.fromAxisAngle(new Quat(), Vec3.UNIT_Z, srt.rotation),
        new Vec3(srt.translation.x, srt.translation.y, z),
        new Vec3(srt.scale.x, srt.scale.y, z),
      );
      Mat4.multiply(transformMatrix, transform4, transformMatrix);
    }
    geometryRenderer.addCircle(
      center3,
      radius,
      color,
      segments,
      depthTest,
      true,
      transformMatrix,
    );
  };
})();
