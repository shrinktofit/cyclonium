import { Color, gfx, Mat4, RenderingSubMesh, Vec2, Vec3 } from 'cc';

import { Canvas3DLineCap, Canvas3DLineJoin } from './types.js';
import type {
  Canvas3DCapsuleOptions,
  Canvas3DCylinderOptions,
  Canvas3DDiscOptions,
  Canvas3DPrimitiveMode,
  Canvas3DPrimitiveOptions,
  Canvas3DQuadOptions,
  Canvas3DRingOptions,
  Canvas3DSphereOptions,
  DrawOptions,
  EnqueueGeometry,
  MeshGeometry,
  PrimitiveDrawState,
  RenderingSubMeshRecord,
  StrokeSegmentWriter,
  StrokeStyle,
  SubPath,
} from './types.js';

export enum PrimitiveEntryType {
  line = 'line',
  box = 'box',
  quad = 'quad',
  cylinder = 'cylinder',
  disc = 'disc',
  ring = 'ring',
  sphere = 'sphere',
  capsule = 'capsule',
}

export type PrimitiveEntry = {
  readonly type: PrimitiveEntryType.line;
  readonly from: Vec3;
  readonly to: Vec3;
} | {
  readonly type: PrimitiveEntryType.box;
  readonly center: Vec3;
  readonly halfExtents: Vec3;
} | {
  readonly type: PrimitiveEntryType.quad;
  readonly corners: readonly Vec3[];
} | {
  readonly type: PrimitiveEntryType.cylinder;
  readonly from: Vec3;
  readonly to: Vec3;
  readonly radius: number;
  readonly radialSegments: number;
  readonly wireSegments: number;
} | {
  readonly type: PrimitiveEntryType.disc;
  readonly center: Vec3;
  readonly normal: Vec3;
  readonly radius: number;
  readonly segments: number;
} | {
  readonly type: PrimitiveEntryType.ring;
  readonly center: Vec3;
  readonly normal: Vec3;
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly segments: number;
} | {
  readonly type: PrimitiveEntryType.sphere;
  readonly center: Vec3;
  readonly radius: number;
  readonly latitudeSegments: number;
  readonly longitudeSegments: number;
  readonly wireSegments: number;
} | {
  readonly type: PrimitiveEntryType.capsule;
  readonly from: Vec3;
  readonly to: Vec3;
  readonly radius: number;
  readonly radialSegments: number;
  readonly wireSegments: number;
  readonly capSegments: number;
};

export const epsilon = 1e-6;
const defaultCircleSegments = 64;
const defaultSphereLatitudeSegments = 12;
const defaultSphereLongitudeSegments = 24;
const defaultCylinderRadialSegments = defaultSphereLongitudeSegments;
const defaultCapsuleCapSegments = 6;
const minCircleSegments = 3;
const minSphereLatitudeSegments = 2;
const minCapsuleCapSegments = 1;
const lineCapLatitudeSegments = 6;
const lineCapLongitudeSegments = 12;
export const roundSegmentRadians = Math.PI / 16;
const vertexStrideF = 7;
const strokeSegmentVertexCount = 8;
const vec3Caches_appendDashedLine3DStroke = createVec3Cache(3);
const vec3Caches_appendSolidLine3DStroke = createVec3Cache(4);
const vec3Caches_appendDiscFill = createVec3Cache(2);
const vec3Caches_appendRingFill = createVec3Cache(8);
const vec3Caches_appendSphereFill = createVec3Cache(2);
const vec3Caches_appendHemisphereWireStroke = createVec3Cache(4);
const vec3Caches_appendHemisphereFill = createVec3Cache(2);
const vec3Caches_appendCylinderFill = createVec3Cache(4);
export const defaultDrawOptions: DrawOptions = {
  depthTest: false,
  depthWrite: false,
};

interface CircleTopology {
  readonly cos: number[];
  readonly sin: number[];
}

interface SphereTopology {
  readonly positions: number[];
  readonly indices: number[];
}

interface CylinderIndexTopology {
  readonly indices: number[];
}

interface HemisphereTopology {
  readonly positions: number[];
  readonly indices: number[];
}

interface Vec3ScratchCache {
  readonly values: Vec3[];
  borrowed: boolean;
}

const circleTopologyCache: Map<number, CircleTopology> = new Map();
const sphereTopologyCache: Map<string, SphereTopology> = new Map();
const cylinderIndexTopologyCache: Map<string, CylinderIndexTopology> = new Map();
const hemisphereTopologyCache: Map<string, HemisphereTopology> = new Map();

export function createMeshGeometry(): MeshGeometry {
  return {
    vertices: [],
    indices: [],
  };
}

export function hasGeometry(geometry: MeshGeometry): boolean {
  return geometry.vertices.length > 0 && geometry.indices.length > 0;
}

export function appendMeshGeometry(out: MeshGeometry, geometry: MeshGeometry): void {
  if (!hasGeometry(geometry)) {
    return;
  }

  const baseVertex = out.vertices.length / vertexStrideF;
  out.vertices.push(...geometry.vertices);
  for (const index of geometry.indices) {
    out.indices.push(baseVertex + index);
  }
}

export function resolvePoint(pointOrX: Vec3 | number, y?: number, z?: number): Vec3 {
  if (typeof pointOrX === 'number') {
    return new Vec3(pointOrX, y ?? 0, z ?? 0);
  }
  return pointOrX.clone();
}

export function setColor(out: Color, value: Readonly<Color> | string): void {
  if (typeof value === 'string') {
    Color.fromHEX(out, value);
    return;
  }
  out.set(value);
}

function getDrawOptions(state: PrimitiveDrawState): DrawOptions {
  return {
    depthTest: state.depthTest,
    depthWrite: state.depthWrite,
  };
}

export function getMaterialKey(options: DrawOptions): string {
  return `${options.depthTest ? 1 : 0}:${options.depthWrite ? 1 : 0}`;
}

export function drawPrimitive(enqueueGeometry: EnqueueGeometry, baseState: PrimitiveDrawState, entries: readonly PrimitiveEntry[], options: Canvas3DPrimitiveOptions | undefined): void {
  const state = createPrimitiveDrawStateWithOptions(baseState, options);
  const mode = options?.mode ?? 'wireframe';

  if (shouldDrawPrimitiveSolid(mode)) {
    const geometry = createMeshGeometry();
    appendPrimitiveEntriesFill(geometry, entries, state);
    enqueueGeometry(geometry, getDrawOptions(state));
  }

  if (shouldDrawPrimitiveWireframe(mode) && state.lineWidth > 0) {
    const geometry = createMeshGeometry();
    appendPrimitiveEntriesStroke(geometry, entries, state);
    enqueueGeometry(geometry, getDrawOptions(state));
  }
}

function shouldDrawPrimitiveSolid(mode: Canvas3DPrimitiveMode): boolean {
  return mode === 'solid' || mode === 'both';
}

function shouldDrawPrimitiveWireframe(mode: Canvas3DPrimitiveMode): boolean {
  return mode === 'wireframe' || mode === 'both';
}

export function createPrimitiveDrawState(): PrimitiveDrawState {
  const transform = new Mat4();
  Mat4.identity(transform);
  return {
    lineWidth: 1,
    lineJoin: Canvas3DLineJoin.miter,
    lineCap: Canvas3DLineCap.butt,
    miterLimit: 10,
    lineDash: [],
    lineDashOffset: 0,
    fillColor: Color.WHITE.clone(),
    strokeColor: Color.WHITE.clone(),
    transform,
    depthTest: true,
    depthWrite: true,
  };
}

export function clonePrimitiveDrawState(state: PrimitiveDrawState): PrimitiveDrawState {
  return copyPrimitiveDrawState(createPrimitiveDrawState(), state);
}

export function copyPrimitiveDrawState(out: PrimitiveDrawState, state: PrimitiveDrawState): PrimitiveDrawState {
  out.lineWidth = state.lineWidth;
  out.lineJoin = state.lineJoin;
  out.lineCap = state.lineCap;
  out.miterLimit = state.miterLimit;
  out.lineDash = state.lineDash.length === 0 ? state.lineDash : state.lineDash.slice();
  out.lineDashOffset = state.lineDashOffset;
  out.fillColor.set(state.fillColor);
  out.strokeColor.set(state.strokeColor);
  out.transform.set(state.transform);
  out.depthTest = state.depthTest;
  out.depthWrite = state.depthWrite;
  return out;
}

function createPrimitiveDrawStateWithOptions(state: PrimitiveDrawState, options: Canvas3DPrimitiveOptions | undefined): PrimitiveDrawState {
  const result = clonePrimitiveDrawState(state);
  if (!options) {
    return result;
  }

  if (options.color) {
    setColor(result.fillColor, options.color);
    setColor(result.strokeColor, options.color);
  }
  if (options.fillColor) {
    setColor(result.fillColor, options.fillColor);
  }
  if (options.strokeColor) {
    setColor(result.strokeColor, options.strokeColor);
  }
  if (options.lineWidth !== undefined) {
    result.lineWidth = Math.max(0, options.lineWidth);
  }
  if (options.lineJoin !== undefined) {
    result.lineJoin = options.lineJoin;
  }
  if (options.lineCap !== undefined) {
    result.lineCap = options.lineCap;
  }
  if (options.lineDash !== undefined) {
    result.lineDash = normalizeLineDash(options.lineDash);
  }
  if (options.lineDashOffset !== undefined) {
    result.lineDashOffset = Number.isFinite(options.lineDashOffset) ? options.lineDashOffset : 0;
  }
  if (options.transform) {
    Mat4.multiply(result.transform, result.transform, options.transform);
  }
  if (options.depthTest !== undefined) {
    result.depthTest = options.depthTest;
  }
  if (options.depthWrite !== undefined) {
    result.depthWrite = options.depthWrite;
  }
  return result;
}

export function resolveCapsule(options: Canvas3DCapsuleOptions): {
  readonly from: Vec3;
  readonly to: Vec3;
  readonly radius: number;
} {
  const radius = Math.max(0, options.radius);
  const height = Math.max(0, options.height);
  const up = options.up?.clone() ?? Vec3.UP.clone();
  if (up.lengthSqr() <= epsilon) {
    up.set(Vec3.UP);
  } else {
    up.normalize();
  }

  const halfSegmentLength = Math.max(0, height * 0.5 - radius);
  const offset = up.multiplyScalar(halfSegmentLength);
  return {
    from: Vec3.subtract(new Vec3(), options.center, offset),
    to: Vec3.add(new Vec3(), options.center, offset),
    radius,
  };
}

export function resolveCylinder(options: Canvas3DCylinderOptions): {
  readonly from: Vec3;
  readonly to: Vec3;
  readonly radius: number;
} {
  const radius = Math.max(0, options.radius);
  const height = Math.max(0, options.height);
  const up = resolveDirection(options.up ?? Vec3.UP);
  const offset = up.multiplyScalar(height * 0.5);
  return {
    from: Vec3.subtract(new Vec3(), options.center, offset),
    to: Vec3.add(new Vec3(), options.center, offset),
    radius,
  };
}

export function createQuadCorners(options: Canvas3DQuadOptions): Vec3[] {
  const halfExtents = resolveQuadHalfExtents(options.halfExtents);
  const basis = createNormalBasis(options.normal);
  const axisA = basis.axisA.multiplyScalar(halfExtents.x);
  const axisB = basis.axisB.multiplyScalar(halfExtents.y);
  return [
    Vec3.subtract(new Vec3(), Vec3.subtract(new Vec3(), options.center, axisA), axisB),
    Vec3.subtract(new Vec3(), Vec3.add(new Vec3(), options.center, axisA), axisB),
    Vec3.add(new Vec3(), Vec3.add(new Vec3(), options.center, axisA), axisB),
    Vec3.add(new Vec3(), Vec3.subtract(new Vec3(), options.center, axisA), axisB),
  ];
}

export function resolveDiscRadius(options: Canvas3DDiscOptions): number {
  return Math.max(0, options.radius);
}

export function resolveCircleSegments(value: number | undefined): number {
  return clampInteger(value, defaultCircleSegments, minCircleSegments);
}

export function resolveCylinderSegments(options: Canvas3DCylinderOptions): {
  readonly radialSegments: number;
  readonly wireSegments: number;
} {
  const manualSegments = normalizeInteger(options.radialSegments, minCircleSegments);
  return {
    radialSegments: manualSegments ?? defaultCylinderRadialSegments,
    wireSegments: manualSegments ?? defaultCircleSegments,
  };
}

export function resolveDiscSegments(options: Canvas3DDiscOptions): number {
  return resolveCircleSegments(options.segments);
}

export function resolveRingSegments(options: Canvas3DRingOptions): number {
  return resolveCircleSegments(options.segments);
}

export function resolveSphereSegments(options: Canvas3DSphereOptions): {
  readonly latitudeSegments: number;
  readonly longitudeSegments: number;
  readonly wireSegments: number;
} {
  const manualLongitudeSegments = normalizeInteger(options.longitudeSegments ?? options.segments, minCircleSegments);
  const longitudeSegments = manualLongitudeSegments ?? defaultSphereLongitudeSegments;
  return {
    latitudeSegments: clampInteger(options.latitudeSegments ?? (options.segments === undefined ? defaultSphereLatitudeSegments : Math.ceil(longitudeSegments * 0.5)), defaultSphereLatitudeSegments, minSphereLatitudeSegments),
    longitudeSegments,
    wireSegments: manualLongitudeSegments ?? defaultCircleSegments,
  };
}

export function resolveCapsuleSegments(options: Canvas3DCapsuleOptions): {
  readonly radialSegments: number;
  readonly wireSegments: number;
  readonly capSegments: number;
} {
  const manualSegments = normalizeInteger(options.radialSegments, minCircleSegments);
  return {
    radialSegments: manualSegments ?? defaultCylinderRadialSegments,
    wireSegments: manualSegments ?? defaultCircleSegments,
    capSegments: clampInteger(options.capSegments, defaultCapsuleCapSegments, minCapsuleCapSegments),
  };
}

export function resolveRingRadii(options: Canvas3DRingOptions): {
  readonly innerRadius: number;
  readonly outerRadius: number;
} {
  return {
    innerRadius: Math.max(0, options.innerRadius),
    outerRadius: Math.max(0, options.outerRadius),
  };
}

export function resolveQuadHalfExtents(halfExtents: number | Vec2): Vec2 {
  if (typeof halfExtents === 'number') {
    const value = Math.max(0, halfExtents);
    return new Vec2(value, value);
  }
  return new Vec2(Math.max(0, halfExtents.x), Math.max(0, halfExtents.y));
}

function clampInteger(value: number | undefined, fallback: number, min: number): number {
  return normalizeInteger(value, min) ?? fallback;
}

function normalizeInteger(value: number | undefined, min: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(min, Math.floor(value));
}

export function normalizeLineDash(value: readonly number[]): number[] {
  const lineDash = value.filter((entry) => {
    return Number.isFinite(entry) && entry > epsilon;
  });
  if (lineDash.length === 0 || sum(lineDash) <= epsilon) {
    return [];
  }
  if (lineDash.length % 2 === 1) {
    lineDash.push(...lineDash);
  }
  return lineDash;
}

export function appendSubPathStroke(geometry: MeshGeometry, subPath: SubPath, style: StrokeStyle, color: Color): void {
  const points = normalizedSubPathPoints(subPath);
  if (appendPlanarPolylineStroke(geometry, points, subPath.closed, style, color)) {
    return;
  }

  const segmentCount = countSubPathStrokeSegments(points, subPath.closed);
  const writer = createStrokeSegmentWriter(geometry, segmentCount);
  if (!writer) {
    return;
  }

  for (let iPoint = 1; iPoint < points.length; iPoint++) {
    const from = points[iPoint - 1];
    const to = points[iPoint];
    if (hasStrokeSegmentLength(from, to)) {
      appendStrokeSegment(writer, from, to, style.lineWidth, color);
    }
  }
  if (subPath.closed && points.length > 2) {
    const from = points[points.length - 1];
    const to = points[0];
    if (hasStrokeSegmentLength(from, to)) {
      appendStrokeSegment(writer, from, to, style.lineWidth, color);
    }
  }
}

export function appendSubPathFill(geometry: MeshGeometry, subPath: SubPath, color: Color): void {
  const points = normalizedSubPathPoints(subPath);
  if (points.length < 3) {
    return;
  }

  const baseVertex = geometry.vertices.length / vertexStrideF;
  for (const point of points) {
    appendVertex(geometry, point, color);
  }
  for (let iPoint = 1; iPoint < points.length - 1; iPoint++) {
    geometry.indices.push(baseVertex, baseVertex + iPoint, baseVertex + iPoint + 1);
  }
}

export function appendBoxStroke(geometry: MeshGeometry, center: Vec3, halfExtents: Vec3, style: StrokeStyle, color: Color): void {
  const corners = createBoxCorners(center, halfExtents);
  if (Math.abs(halfExtents.z) <= epsilon && appendPlanarPolylineStroke(geometry, corners.slice(0, 4), true, style, color)) {
    return;
  }

  const segmentCount = countBoxStrokeSegments(corners);
  const writer = createStrokeSegmentWriter(geometry, segmentCount);
  if (!writer) {
    return;
  }

  for (const [fromIndex, toIndex] of boxEdges) {
    const from = corners[fromIndex];
    const to = corners[toIndex];
    if (hasStrokeSegmentLength(from, to)) {
      appendStrokeSegment(writer, from, to, style.lineWidth, color);
    }
  }
}

export function appendBoxFill(geometry: MeshGeometry, center: Vec3, halfExtents: Vec3, color: Color): void {
  const corners = createBoxCorners(center, halfExtents);
  appendBoxCornersFill(geometry, corners, color);
}

function appendBoxCornersStroke(geometry: MeshGeometry, corners: readonly Vec3[], style: StrokeStyle, color: Color): void {
  const segmentCount = countBoxStrokeSegments(corners);
  const writer = createStrokeSegmentWriter(geometry, segmentCount);
  if (!writer) {
    return;
  }

  for (const [fromIndex, toIndex] of boxEdges) {
    const from = corners[fromIndex];
    const to = corners[toIndex];
    if (hasStrokeSegmentLength(from, to)) {
      appendStrokeSegment(writer, from, to, style.lineWidth, color);
    }
  }
}

function appendBoxCornersFill(geometry: MeshGeometry, corners: readonly Vec3[], color: Color): void {
  const baseVertex = geometry.vertices.length / vertexStrideF;
  for (const corner of corners) {
    appendVertex(geometry, corner, color);
  }
  for (const index of boxTriangleIndices) {
    geometry.indices.push(baseVertex + index);
  }
}

function appendPrimitiveEntriesStroke(geometry: MeshGeometry, entries: readonly PrimitiveEntry[], state: PrimitiveDrawState): void {
  for (const entry of entries) {
    switch (entry.type) {
    case PrimitiveEntryType.line:
      appendLine3DStroke(geometry, transformPoint(entry.from, state.transform), transformPoint(entry.to, state.transform), state, state.strokeColor);
      break;
    case PrimitiveEntryType.box:
      appendBoxCornersStroke(geometry, transformPoints(createBoxCorners(entry.center, entry.halfExtents), state.transform), state, state.strokeColor);
      break;
    case PrimitiveEntryType.quad:
      appendQuadCornersStroke(geometry, transformPoints(entry.corners, state.transform), state, state.strokeColor);
      break;
    case PrimitiveEntryType.cylinder:
      appendCylinderWireStroke(geometry, entry.from, entry.to, entry.radius, entry.wireSegments, state, state.strokeColor);
      break;
    case PrimitiveEntryType.disc:
      appendDiscWireStroke(geometry, entry.center, entry.normal, entry.radius, entry.segments, state, state.strokeColor);
      break;
    case PrimitiveEntryType.ring:
      appendRingWireStroke(geometry, entry.center, entry.normal, entry.innerRadius, entry.outerRadius, entry.segments, state, state.strokeColor);
      break;
    case PrimitiveEntryType.sphere:
      appendSphereWireStroke(geometry, entry.center, entry.radius, entry.wireSegments, state, state.strokeColor);
      break;
    case PrimitiveEntryType.capsule:
      appendCapsuleWireStroke(geometry, entry.from, entry.to, entry.radius, entry.wireSegments, entry.capSegments, state, state.strokeColor);
      break;
    }
  }
}

function appendPrimitiveEntriesFill(geometry: MeshGeometry, entries: readonly PrimitiveEntry[], state: PrimitiveDrawState): void {
  for (const entry of entries) {
    switch (entry.type) {
    case PrimitiveEntryType.line:
      break;
    case PrimitiveEntryType.box:
      appendBoxCornersFill(geometry, transformPoints(createBoxCorners(entry.center, entry.halfExtents), state.transform), state.fillColor);
      break;
    case PrimitiveEntryType.quad:
      appendQuadCornersFill(geometry, transformPoints(entry.corners, state.transform), state.fillColor);
      break;
    case PrimitiveEntryType.cylinder:
      appendCylinderFill(geometry, entry.from, entry.to, entry.radius, entry.radialSegments, state.transform, state.fillColor);
      break;
    case PrimitiveEntryType.disc:
      appendDiscFill(geometry, entry.center, entry.normal, entry.radius, entry.segments, state.transform, state.fillColor);
      break;
    case PrimitiveEntryType.ring:
      appendRingFill(geometry, entry.center, entry.normal, entry.innerRadius, entry.outerRadius, entry.segments, state.transform, state.fillColor);
      break;
    case PrimitiveEntryType.sphere:
      appendSphereFill(geometry, entry.center, entry.radius, entry.latitudeSegments, entry.longitudeSegments, state.transform, state.fillColor);
      break;
    case PrimitiveEntryType.capsule:
      appendCapsuleFill(geometry, entry.from, entry.to, entry.radius, entry.radialSegments, entry.capSegments, state.transform, state.fillColor);
      break;
    }
  }
}

function appendLine3DStroke(geometry: MeshGeometry, from: Vec3, to: Vec3, style: StrokeStyle, color: Color): void {
  if (!hasStrokeSegmentLength(from, to)) {
    return;
  }

  if (style.lineDash.length > 0) {
    appendDashedLine3DStroke(geometry, from, to, style, color);
    return;
  }

  appendSolidLine3DStroke(geometry, from, to, style, color);
}

function appendDashedLine3DStroke(geometry: MeshGeometry, from: Vec3, to: Vec3, style: StrokeStyle, color: Color): void {
  const segmentLength = Vec3.distance(from, to);
  if (segmentLength <= epsilon) {
    return;
  }

  const vec3Cache = borrowVec3ScratchCache(vec3Caches_appendDashedLine3DStroke);
  let pVec3Cache = 0;
  const direction = Vec3.subtract(vec3Cache[pVec3Cache++], to, from).normalize();
  const dashState = createDashState(style.lineDash, style.lineDashOffset);
  const startPoint = vec3Cache[pVec3Cache++];
  const endPoint = vec3Cache[pVec3Cache++];
  let traveled = 0;
  while (segmentLength - traveled > epsilon) {
    const step = Math.min(segmentLength - traveled, dashState.remaining);
    if (dashState.drawing) {
      Vec3.scaleAndAdd(startPoint, from, direction, traveled);
      Vec3.scaleAndAdd(endPoint, from, direction, traveled + step);
      appendSolidLine3DStroke(geometry, startPoint, endPoint, style, color);
    }
    traveled += step;
    dashState.remaining -= step;
    if (dashState.remaining <= epsilon) {
      advanceDashState(dashState);
    }
  }
  releaseVec3ScratchCache(vec3Caches_appendDashedLine3DStroke);
}

function appendSolidLine3DStroke(geometry: MeshGeometry, from: Vec3, to: Vec3, style: StrokeStyle, color: Color): void {
  if (!hasStrokeSegmentLength(from, to)) {
    return;
  }

  const writer = createStrokeSegmentWriter(geometry, 1);
  if (!writer) {
    return;
  }

  const vec3Cache = borrowVec3ScratchCache(vec3Caches_appendSolidLine3DStroke);
  let pVec3Cache = 0;
  const start = vec3Cache[pVec3Cache++].set(from);
  const end = vec3Cache[pVec3Cache++].set(to);
  const direction = Vec3.subtract(vec3Cache[pVec3Cache++], end, start).normalize();

  const halfWidth = style.lineWidth * 0.5;
  if (style.lineCap === Canvas3DLineCap.square) {
    Vec3.scaleAndAdd(start, start, direction, -halfWidth);
    Vec3.scaleAndAdd(end, end, direction, halfWidth);
  }

  appendStrokeSegment(writer, start, end, style.lineWidth, color);
  releaseVec3ScratchCache(vec3Caches_appendSolidLine3DStroke);

  if (style.lineCap === Canvas3DLineCap.round) {
    const transform = new Mat4();
    Mat4.identity(transform);
    appendSphereFill(geometry, from, halfWidth, lineCapLatitudeSegments, lineCapLongitudeSegments, transform, color);
    appendSphereFill(geometry, to, halfWidth, lineCapLatitudeSegments, lineCapLongitudeSegments, transform, color);
  }
}

function appendQuadCornersStroke(geometry: MeshGeometry, corners: readonly Vec3[], style: StrokeStyle, color: Color): void {
  if (corners.length < 4) {
    return;
  }

  appendSubPathStroke(geometry, {
    points: corners.slice(0, 4),
    closed: true,
  }, style, color);
}

function appendQuadCornersFill(geometry: MeshGeometry, corners: readonly Vec3[], color: Color): void {
  if (corners.length < 4) {
    return;
  }

  appendQuad(geometry, corners[0], corners[1], corners[2], corners[3], color);
}

function appendDiscWireStroke(geometry: MeshGeometry, center: Vec3, normal: Vec3, radius: number, segments: number, state: PrimitiveDrawState, color: Color): void {
  if (radius <= 0) {
    return;
  }

  const basis = createNormalBasis(normal);
  appendPlaneCircleStroke(geometry, center, radius, basis.axisA, basis.axisB, segments, state, color);
}

function appendDiscFill(geometry: MeshGeometry, center: Vec3, normal: Vec3, radius: number, segments: number, transform: Mat4, color: Color): void {
  if (radius <= 0) {
    return;
  }

  const vec3Cache = borrowVec3ScratchCache(vec3Caches_appendDiscFill);
  let pVec3Cache = 0;
  const point = vec3Cache[pVec3Cache++];
  const transformedPoint = vec3Cache[pVec3Cache++];
  const basis = createNormalBasis(normal);
  const centerVertex = appendVertex(geometry, transformPointInto(transformedPoint, center, transform), color);
  const firstRingVertex = geometry.vertices.length / vertexStrideF;
  for (let iPoint = 0; iPoint < segments; iPoint++) {
    setPlaneCirclePoint(point, center, radius, basis.axisA, basis.axisB, iPoint, segments);
    appendVertex(geometry, transformPointInto(transformedPoint, point, transform), color);
  }
  releaseVec3ScratchCache(vec3Caches_appendDiscFill);

  for (let iPoint = 0; iPoint < segments; iPoint++) {
    geometry.indices.push(
      centerVertex,
      firstRingVertex + iPoint,
      firstRingVertex + ((iPoint + 1) % segments),
    );
  }
}

function appendRingWireStroke(geometry: MeshGeometry, center: Vec3, normal: Vec3, innerRadius: number, outerRadius: number, segments: number, state: PrimitiveDrawState, color: Color): void {
  if (outerRadius <= 0) {
    return;
  }

  const basis = createNormalBasis(normal);
  appendPlaneCircleStroke(geometry, center, outerRadius, basis.axisA, basis.axisB, segments, state, color);
  if (innerRadius > epsilon && innerRadius < outerRadius) {
    appendPlaneCircleStroke(geometry, center, innerRadius, basis.axisA, basis.axisB, segments, state, color);
  }
}

function appendRingFill(geometry: MeshGeometry, center: Vec3, normal: Vec3, innerRadius: number, outerRadius: number, segments: number, transform: Mat4, color: Color): void {
  if (outerRadius <= 0) {
    return;
  }

  if (innerRadius <= epsilon) {
    appendDiscFill(geometry, center, normal, outerRadius, segments, transform, color);
    return;
  }

  if (innerRadius >= outerRadius) {
    return;
  }

  const vec3Cache = borrowVec3ScratchCache(vec3Caches_appendRingFill);
  const basis = createNormalBasis(normal);
  let pVec3Cache = 0;
  const outerPoint = vec3Cache[pVec3Cache++];
  const innerPoint = vec3Cache[pVec3Cache++];
  const innerNextPoint = vec3Cache[pVec3Cache++];
  const outerNextPoint = vec3Cache[pVec3Cache++];
  const transformedOuterPoint = vec3Cache[pVec3Cache++];
  const transformedInnerPoint = vec3Cache[pVec3Cache++];
  const transformedInnerNextPoint = vec3Cache[pVec3Cache++];
  const transformedOuterNextPoint = vec3Cache[pVec3Cache++];
  for (let iPoint = 0; iPoint < segments; iPoint++) {
    const nextPoint = (iPoint + 1) % segments;
    setPlaneCirclePoint(outerPoint, center, outerRadius, basis.axisA, basis.axisB, iPoint, segments);
    setPlaneCirclePoint(innerPoint, center, innerRadius, basis.axisA, basis.axisB, iPoint, segments);
    setPlaneCirclePoint(innerNextPoint, center, innerRadius, basis.axisA, basis.axisB, nextPoint, segments);
    setPlaneCirclePoint(outerNextPoint, center, outerRadius, basis.axisA, basis.axisB, nextPoint, segments);
    appendQuad(
      geometry,
      transformPointInto(transformedOuterPoint, outerPoint, transform),
      transformPointInto(transformedInnerPoint, innerPoint, transform),
      transformPointInto(transformedInnerNextPoint, innerNextPoint, transform),
      transformPointInto(transformedOuterNextPoint, outerNextPoint, transform),
      color,
    );
  }
  releaseVec3ScratchCache(vec3Caches_appendRingFill);
}

function appendSphereWireStroke(geometry: MeshGeometry, center: Vec3, radius: number, segments: number, state: PrimitiveDrawState, color: Color): void {
  if (radius <= 0) {
    return;
  }

  appendPlaneCircleStroke(geometry, center, radius, new Vec3(1, 0, 0), new Vec3(0, 1, 0), segments, state, color);
  appendPlaneCircleStroke(geometry, center, radius, new Vec3(1, 0, 0), new Vec3(0, 0, 1), segments, state, color);
  appendPlaneCircleStroke(geometry, center, radius, new Vec3(0, 1, 0), new Vec3(0, 0, 1), segments, state, color);
}

function appendSphereFill(geometry: MeshGeometry, center: Vec3, radius: number, latitudeSegments: number, longitudeSegments: number, transform: Mat4, color: Color): void {
  if (radius <= 0) {
    return;
  }

  const vec3Cache = borrowVec3ScratchCache(vec3Caches_appendSphereFill);
  let pVec3Cache = 0;
  const point = vec3Cache[pVec3Cache++];
  const transformedPoint = vec3Cache[pVec3Cache++];
  const topology = getSphereTopology(latitudeSegments, longitudeSegments);
  const baseVertex = geometry.vertices.length / vertexStrideF;
  for (let pPosition = 0; pPosition < topology.positions.length; pPosition += 3) {
    point.set(
      center.x + topology.positions[pPosition] * radius,
      center.y + topology.positions[pPosition + 1] * radius,
      center.z + topology.positions[pPosition + 2] * radius,
    );
    appendVertex(geometry, transformPointInto(transformedPoint, point, transform), color);
  }
  releaseVec3ScratchCache(vec3Caches_appendSphereFill);

  appendTopologyIndices(geometry, baseVertex, topology.indices);
}

function appendCapsuleWireStroke(geometry: MeshGeometry, from: Vec3, to: Vec3, radius: number, radialSegments: number, capSegments: number, state: PrimitiveDrawState, color: Color): void {
  if (radius <= 0) {
    return;
  }

  if (!hasStrokeSegmentLength(from, to)) {
    appendSphereWireStroke(geometry, from, radius, radialSegments, state, color);
    return;
  }

  const direction = Vec3.subtract(new Vec3(), to, from).normalize();
  appendCylinderWireStroke(geometry, from, to, radius, radialSegments, state, color);
  appendHemisphereWireStroke(geometry, from, direction.clone().multiplyScalar(-1), radius, radialSegments, capSegments, state, color);
  appendHemisphereWireStroke(geometry, to, direction, radius, radialSegments, capSegments, state, color);
}

function appendCapsuleFill(geometry: MeshGeometry, from: Vec3, to: Vec3, radius: number, radialSegments: number, capSegments: number, transform: Mat4, color: Color): void {
  if (radius <= 0) {
    return;
  }

  if (!hasStrokeSegmentLength(from, to)) {
    appendSphereFill(geometry, from, radius, capSegments * 2, radialSegments, transform, color);
    return;
  }

  const direction = Vec3.subtract(new Vec3(), to, from).normalize();
  appendCylinderFill(geometry, from, to, radius, radialSegments, transform, color, false);
  appendHemisphereFill(geometry, from, direction.clone().multiplyScalar(-1), radius, radialSegments, capSegments, transform, color);
  appendHemisphereFill(geometry, to, direction, radius, radialSegments, capSegments, transform, color);
}

function appendHemisphereWireStroke(geometry: MeshGeometry, center: Vec3, axis: Vec3, radius: number, radialSegments: number, capSegments: number, state: PrimitiveDrawState, color: Color): void {
  const basis = createDirectionBasis(axis);
  if (!basis) {
    return;
  }

  const vec3Cache = borrowVec3ScratchCache(vec3Caches_appendHemisphereWireStroke);
  let pVec3Cache = 0;
  const radialDirection = vec3Cache[pVec3Cache++];
  const point = vec3Cache[pVec3Cache++];
  const transformedPoint = vec3Cache[pVec3Cache++];
  const ringCenter = vec3Cache[pVec3Cache++];
  for (let iMeridian = 0; iMeridian < 4; iMeridian++) {
    const phi = iMeridian / 4 * Math.PI * 2;
    setBasisDirection(radialDirection, basis.normalA, basis.normalB, phi);
    const points: Vec3[] = [];
    for (let iCap = 0; iCap <= capSegments; iCap++) {
      const theta = iCap / capSegments * Math.PI * 0.5;
      setHemispherePoint(point, center, radius, axis, radialDirection, theta);
      points.push(transformPointInto(transformedPoint, point, state.transform).clone());
    }
    appendSubPathStroke(geometry, {
      points,
      closed: false,
    }, state, color);
  }

  if (capSegments > 1) {
    for (let iCap = 1; iCap < capSegments; iCap++) {
      const theta = iCap / capSegments * Math.PI * 0.5;
      Vec3.scaleAndAdd(ringCenter, center, axis, Math.cos(theta) * radius);
      appendPlaneCircleStroke(geometry, ringCenter, Math.sin(theta) * radius, basis.normalA, basis.normalB, radialSegments, state, color);
    }
  }
  releaseVec3ScratchCache(vec3Caches_appendHemisphereWireStroke);
}

function appendHemisphereFill(geometry: MeshGeometry, center: Vec3, axis: Vec3, radius: number, radialSegments: number, capSegments: number, transform: Mat4, color: Color): void {
  const basis = createDirectionBasis(axis);
  if (!basis) {
    return;
  }

  const vec3Cache = borrowVec3ScratchCache(vec3Caches_appendHemisphereFill);
  let pVec3Cache = 0;
  const point = vec3Cache[pVec3Cache++];
  const transformedPoint = vec3Cache[pVec3Cache++];
  const topology = getHemisphereTopology(radialSegments, capSegments);
  const baseVertex = geometry.vertices.length / vertexStrideF;
  for (let pPosition = 0; pPosition < topology.positions.length; pPosition += 3) {
    const radialX = topology.positions[pPosition];
    const radialY = topology.positions[pPosition + 1];
    const axisScale = topology.positions[pPosition + 2];
    point.set(
      center.x + (basis.normalA.x * radialX + basis.normalB.x * radialY + axis.x * axisScale) * radius,
      center.y + (basis.normalA.y * radialX + basis.normalB.y * radialY + axis.y * axisScale) * radius,
      center.z + (basis.normalA.z * radialX + basis.normalB.z * radialY + axis.z * axisScale) * radius,
    );
    appendVertex(geometry, transformPointInto(transformedPoint, point, transform), color);
  }
  releaseVec3ScratchCache(vec3Caches_appendHemisphereFill);

  appendTopologyIndices(geometry, baseVertex, topology.indices);
}

function appendCylinderWireStroke(geometry: MeshGeometry, from: Vec3, to: Vec3, radius: number, radialSegments: number, state: PrimitiveDrawState, color: Color): void {
  const basis = createAxisBasis(from, to);
  if (!basis) {
    return;
  }

  appendPlaneCircleStroke(geometry, from, radius, basis.normalA, basis.normalB, radialSegments, state, color);
  appendPlaneCircleStroke(geometry, to, radius, basis.normalA, basis.normalB, radialSegments, state, color);

  for (let iSide = 0; iSide < 4; iSide++) {
    const iPoint = Math.floor(iSide * radialSegments / 4);
    appendLine3DStroke(
      geometry,
      transformPoint(createPlaneCirclePoint(from, radius, basis.normalA, basis.normalB, iPoint, radialSegments), state.transform),
      transformPoint(createPlaneCirclePoint(to, radius, basis.normalA, basis.normalB, iPoint, radialSegments), state.transform),
      state,
      color,
    );
  }
}

function appendCylinderFill(geometry: MeshGeometry, from: Vec3, to: Vec3, radius: number, radialSegments: number, transform: Mat4, color: Color, includeCaps: boolean = true): void {
  const basis = createAxisBasis(from, to);
  if (!basis) {
    return;
  }

  const vec3Cache = borrowVec3ScratchCache(vec3Caches_appendCylinderFill);
  let pVec3Cache = 0;
  const point = vec3Cache[pVec3Cache++];
  const transformedPoint = vec3Cache[pVec3Cache++];
  const topology = getCircleTopology(radialSegments);
  const baseVertex = geometry.vertices.length / vertexStrideF;
  for (let iPoint = 0; iPoint < radialSegments; iPoint++) {
    setPlaneCirclePoint(point, from, radius, basis.normalA, basis.normalB, iPoint, radialSegments);
    appendVertex(geometry, transformPointInto(transformedPoint, point, transform), color);
  }
  for (let iPoint = 0; iPoint < radialSegments; iPoint++) {
    point.set(
      to.x + (basis.normalA.x * topology.cos[iPoint] + basis.normalB.x * topology.sin[iPoint]) * radius,
      to.y + (basis.normalA.y * topology.cos[iPoint] + basis.normalB.y * topology.sin[iPoint]) * radius,
      to.z + (basis.normalA.z * topology.cos[iPoint] + basis.normalB.z * topology.sin[iPoint]) * radius,
    );
    appendVertex(geometry, transformPointInto(transformedPoint, point, transform), color);
  }

  if (includeCaps) {
    appendVertex(geometry, transformPointInto(transformedPoint, from, transform), color);
    appendVertex(geometry, transformPointInto(transformedPoint, to, transform), color);
  }
  releaseVec3ScratchCache(vec3Caches_appendCylinderFill);

  appendTopologyIndices(geometry, baseVertex, getCylinderIndexTopology(radialSegments, includeCaps).indices);
}

function appendPlaneCircleStroke(geometry: MeshGeometry, center: Vec3, radius: number, axisA: Vec3, axisB: Vec3, segments: number, state: PrimitiveDrawState, color: Color): void {
  const points: Vec3[] = [];
  for (let iPoint = 0; iPoint < segments; iPoint++) {
    points.push(transformPoint(createPlaneCirclePoint(center, radius, axisA, axisB, iPoint, segments), state.transform));
  }
  appendSubPathStroke(geometry, {
    points,
    closed: true,
  }, state, color);
}

export function appendCircleStroke(geometry: MeshGeometry, center: Vec3, radius: number, style: StrokeStyle, color: Color): void {
  if (radius <= 0) {
    return;
  }

  if (style.lineDash.length > 0) {
    appendPlanarPolylineStroke(geometry, createCirclePoints(center, radius), true, style, color);
    return;
  }

  const innerRadius = Math.max(0, radius - style.lineWidth * 0.5);
  const outerRadius = radius + style.lineWidth * 0.5;
  appendCircleRingStroke(geometry, center, innerRadius, outerRadius, color);
}

function appendCircleRingStroke(geometry: MeshGeometry, center: Vec3, innerRadius: number, outerRadius: number, color: Color): void {
  if (outerRadius <= 0) {
    return;
  }

  if (innerRadius <= epsilon) {
    appendCircleFill(geometry, center, outerRadius, color);
    return;
  }

  const outerPoint = new Vec3();
  const innerPoint = new Vec3();
  for (let iPoint = 0; iPoint < defaultCircleSegments; iPoint++) {
    setCirclePoint(outerPoint, center, outerRadius, iPoint);
    setCirclePoint(innerPoint, center, innerRadius, iPoint);
    const nextPoint = (iPoint + 1) % defaultCircleSegments;
    const outerNext = createCirclePoint(center, outerRadius, nextPoint);
    const innerNext = createCirclePoint(center, innerRadius, nextPoint);
    appendQuad(geometry, outerPoint, innerPoint, innerNext, outerNext, color);
  }
}

export function appendCircleFill(geometry: MeshGeometry, center: Vec3, radius: number, color: Color): void {
  if (radius <= 0) {
    return;
  }

  const centerVertex = appendVertex(geometry, center, color);
  const firstRingVertex = geometry.vertices.length / vertexStrideF;
  for (let iPoint = 0; iPoint < defaultCircleSegments; iPoint++) {
    appendVertex(geometry, createCirclePoint(center, radius, iPoint), color);
  }
  for (let iPoint = 0; iPoint < defaultCircleSegments; iPoint++) {
    geometry.indices.push(
      centerVertex,
      firstRingVertex + iPoint,
      firstRingVertex + ((iPoint + 1) % defaultCircleSegments),
    );
  }
}

function createStrokeSegmentWriter(geometry: MeshGeometry, segmentCount: number): StrokeSegmentWriter | undefined {
  if (segmentCount <= 0) {
    return undefined;
  }

  const baseVertex = geometry.vertices.length / vertexStrideF;
  const vertexOffsetF = geometry.vertices.length;
  const indexOffset = geometry.indices.length;
  geometry.vertices.length += segmentCount * strokeSegmentVertexCount * vertexStrideF;
  geometry.indices.length += segmentCount * strokeBoxTriangleIndices.length;
  return {
    geometry,
    direction: new Vec3(),
    normalA: new Vec3(),
    normalB: new Vec3(),
    vertexOffsetF,
    indexOffset,
    baseVertex,
  };
}

function appendStrokeSegment(writer: StrokeSegmentWriter, from: Vec3, to: Vec3, strokeWidth: number, color: Color): void {
  const direction = Vec3.subtract(writer.direction, to, from);
  if (direction.lengthSqr() <= epsilon) {
    return;
  }
  direction.normalize();

  const halfWidth = strokeWidth * 0.5;
  const referenceAxis = Math.abs(Vec3.dot(direction, Vec3.UP)) > 0.95 ? Vec3.RIGHT : Vec3.UP;
  const normalA = Vec3.cross(writer.normalA, direction, referenceAxis).normalize();
  const normalB = Vec3.cross(writer.normalB, direction, normalA).normalize();
  normalA.multiplyScalar(halfWidth);
  normalB.multiplyScalar(halfWidth);

  const ax = normalA.x;
  const ay = normalA.y;
  const az = normalA.z;
  const bx = normalB.x;
  const by = normalB.y;
  const bz = normalB.z;

  writeStrokeVertex(writer, from, ax + bx, ay + by, az + bz, color);
  writeStrokeVertex(writer, from, ax - bx, ay - by, az - bz, color);
  writeStrokeVertex(writer, from, -ax - bx, -ay - by, -az - bz, color);
  writeStrokeVertex(writer, from, bx - ax, by - ay, bz - az, color);
  writeStrokeVertex(writer, to, ax + bx, ay + by, az + bz, color);
  writeStrokeVertex(writer, to, ax - bx, ay - by, az - bz, color);
  writeStrokeVertex(writer, to, -ax - bx, -ay - by, -az - bz, color);
  writeStrokeVertex(writer, to, bx - ax, by - ay, bz - az, color);

  for (const index of strokeBoxTriangleIndices) {
    writer.geometry.indices[writer.indexOffset++] = writer.baseVertex + index;
  }
  writer.baseVertex += strokeSegmentVertexCount;
}

function writeStrokeVertex(writer: StrokeSegmentWriter, center: Vec3, offsetX: number, offsetY: number, offsetZ: number, color: Color): void {
  const vertices = writer.geometry.vertices;
  let offset = writer.vertexOffsetF;
  vertices[offset++] = center.x + offsetX;
  vertices[offset++] = center.y + offsetY;
  vertices[offset++] = center.z + offsetZ;
  vertices[offset++] = color.x;
  vertices[offset++] = color.y;
  vertices[offset++] = color.z;
  vertices[offset++] = color.w;
  writer.vertexOffsetF = offset;
}

function countSubPathStrokeSegments(points: readonly Vec3[], closed: boolean): number {
  let segmentCount = 0;
  for (let iPoint = 1; iPoint < points.length; iPoint++) {
    if (hasStrokeSegmentLength(points[iPoint - 1], points[iPoint])) {
      segmentCount++;
    }
  }
  if (closed && points.length > 2 && hasStrokeSegmentLength(points[points.length - 1], points[0])) {
    segmentCount++;
  }
  return segmentCount;
}

function countBoxStrokeSegments(corners: readonly Vec3[]): number {
  let segmentCount = 0;
  for (const [fromIndex, toIndex] of boxEdges) {
    if (hasStrokeSegmentLength(corners[fromIndex], corners[toIndex])) {
      segmentCount++;
    }
  }
  return segmentCount;
}

function hasStrokeSegmentLength(from: Vec3, to: Vec3): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  return dx * dx + dy * dy + dz * dz > epsilon;
}

interface PlanarStrokeSegment {
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly direction: Vec3;
  readonly normal: Vec3;
}

function appendPlanarPolylineStroke(geometry: MeshGeometry, points: readonly Vec3[], closed: boolean, style: StrokeStyle, color: Color): boolean {
  const strokePoints = normalizedStrokePoints(points, closed);
  if (!isPlanarXY(strokePoints)) {
    return false;
  }

  if (strokePoints.length < (closed ? 3 : 2)) {
    return true;
  }

  if (style.lineDash.length > 0) {
    appendDashedPlanarPolylineStroke(geometry, strokePoints, closed, style, color);
    return true;
  }

  appendSolidPlanarPolylineStroke(geometry, strokePoints, closed, style, color);
  return true;
}

function appendSolidPlanarPolylineStroke(geometry: MeshGeometry, strokePoints: readonly Vec3[], closed: boolean, style: StrokeStyle, color: Color): void {
  const segments = createPlanarStrokeSegments(strokePoints, closed);
  if (!segments) {
    return;
  }

  const halfWidth = style.lineWidth * 0.5;
  for (let iSegment = 0; iSegment < segments.length; iSegment++) {
    const segment = segments[iSegment];
    const isFirst = iSegment === 0;
    const isLast = iSegment === segments.length - 1;
    const startExtension = !closed && isFirst && style.lineCap === Canvas3DLineCap.square ? halfWidth : 0;
    const endExtension = !closed && isLast && style.lineCap === Canvas3DLineCap.square ? halfWidth : 0;
    appendPlanarSegmentBody(geometry, strokePoints[segment.fromIndex], strokePoints[segment.toIndex], segment.direction, segment.normal, halfWidth, startExtension, endExtension, color);
  }

  if (closed) {
    for (let iPoint = 0; iPoint < strokePoints.length; iPoint++) {
      appendPlanarStrokeJoin(geometry, strokePoints[iPoint], segments[(iPoint - 1 + segments.length) % segments.length], segments[iPoint], style, color);
    }
    return;
  }

  for (let iPoint = 1; iPoint < strokePoints.length - 1; iPoint++) {
    appendPlanarStrokeJoin(geometry, strokePoints[iPoint], segments[iPoint - 1], segments[iPoint], style, color);
  }
  appendPlanarCaps(geometry, strokePoints, segments, style, color);
}

function appendDashedPlanarPolylineStroke(geometry: MeshGeometry, strokePoints: readonly Vec3[], closed: boolean, style: StrokeStyle, color: Color): void {
  const segments = createPlanarStrokeSegments(strokePoints, closed);
  if (!segments) {
    return;
  }

  const dashState = createDashState(style.lineDash, style.lineDashOffset);
  const fragment: Vec3[] = [];
  const flushFragment = () => {
    if (fragment.length >= 2) {
      appendSolidPlanarPolylineStroke(geometry, fragment, false, style, color);
    }
    fragment.length = 0;
  };
  const appendFragmentPoint = (point: Vec3) => {
    const previous = fragment[fragment.length - 1];
    if (!previous || hasStrokeSegmentLength(previous, point)) {
      fragment.push(point.clone());
    }
  };

  const startPoint = new Vec3();
  const endPoint = new Vec3();
  for (const segment of segments) {
    const from = strokePoints[segment.fromIndex];
    const to = strokePoints[segment.toIndex];
    const segmentLength = Vec3.distance(from, to);
    let traveled = 0;
    while (segmentLength - traveled > epsilon) {
      const step = Math.min(segmentLength - traveled, dashState.remaining);
      setLerpPoint(startPoint, from, to, traveled / segmentLength);
      setLerpPoint(endPoint, from, to, (traveled + step) / segmentLength);
      if (dashState.drawing) {
        appendFragmentPoint(startPoint);
        appendFragmentPoint(endPoint);
      }
      traveled += step;
      dashState.remaining -= step;
      if (dashState.remaining <= epsilon) {
        if (dashState.drawing) {
          flushFragment();
        }
        advanceDashState(dashState);
      }
    }
  }
  flushFragment();
}

function createPlanarStrokeSegments(strokePoints: readonly Vec3[], closed: boolean): PlanarStrokeSegment[] | undefined {
  const segmentCount = closed ? strokePoints.length : strokePoints.length - 1;
  const segments: PlanarStrokeSegment[] = [];
  for (let iSegment = 0; iSegment < segmentCount; iSegment++) {
    const from = strokePoints[iSegment];
    const to = strokePoints[(iSegment + 1) % strokePoints.length];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length <= epsilon) {
      return undefined;
    }
    const dirX = dx / length;
    const dirY = dy / length;
    segments.push({
      fromIndex: iSegment,
      toIndex: (iSegment + 1) % strokePoints.length,
      direction: new Vec3(dirX, dirY, 0),
      normal: new Vec3(-dirY, dirX, 0),
    });
  }
  return segments;
}

function appendPlanarSegmentBody(geometry: MeshGeometry, from: Vec3, to: Vec3, direction: Vec3, normal: Vec3, halfWidth: number, startExtension: number, endExtension: number, color: Color): void {
  const start = new Vec3(from.x - direction.x * startExtension, from.y - direction.y * startExtension, from.z);
  const end = new Vec3(to.x + direction.x * endExtension, to.y + direction.y * endExtension, to.z);
  const leftStart = new Vec3(start.x + normal.x * halfWidth, start.y + normal.y * halfWidth, start.z);
  const rightStart = new Vec3(start.x - normal.x * halfWidth, start.y - normal.y * halfWidth, start.z);
  const rightEnd = new Vec3(end.x - normal.x * halfWidth, end.y - normal.y * halfWidth, end.z);
  const leftEnd = new Vec3(end.x + normal.x * halfWidth, end.y + normal.y * halfWidth, end.z);
  appendQuad(geometry, leftStart, rightStart, rightEnd, leftEnd, color);
}

function appendPlanarStrokeJoin(geometry: MeshGeometry, point: Vec3, prevSegment: PlanarStrokeSegment, nextSegment: PlanarStrokeSegment, style: StrokeStyle, color: Color): void {
  const turn = cross2D(prevSegment.direction.x, prevSegment.direction.y, nextSegment.direction.x, nextSegment.direction.y);
  if (Math.abs(turn) <= epsilon) {
    return;
  }

  const halfWidth = style.lineWidth * 0.5;
  const outerSign = turn > 0 ? -1 : 1;
  const offset = outerSign * halfWidth;
  const prevOuter = createPlanarOffsetPoint(point, prevSegment.normal, offset);
  const nextOuter = createPlanarOffsetPoint(point, nextSegment.normal, offset);
  switch (style.lineJoin) {
  case Canvas3DLineJoin.round:
    appendRoundJoin(geometry, point, prevOuter, nextOuter, turn, color);
    break;
  case Canvas3DLineJoin.bevel:
    appendTriangle(geometry, point, prevOuter, nextOuter, color);
    break;
  case Canvas3DLineJoin.miter:
    appendMiterJoin(geometry, point, prevSegment, nextSegment, prevOuter, nextOuter, offset, style.miterLimit, color);
    break;
  }
}

function appendMiterJoin(geometry: MeshGeometry, point: Vec3, prevSegment: PlanarStrokeSegment, nextSegment: PlanarStrokeSegment, prevOuter: Vec3, nextOuter: Vec3, offset: number, miterLimit: number, color: Color): void {
  const miter = calculatePlanarMiterPoint(point, prevSegment.direction, prevSegment.normal, nextSegment.direction, nextSegment.normal, offset, miterLimit);
  if (!miter) {
    appendTriangle(geometry, point, prevOuter, nextOuter, color);
    return;
  }
  appendTriangle(geometry, point, prevOuter, miter, color);
  appendTriangle(geometry, point, miter, nextOuter, color);
}

function calculatePlanarMiterPoint(point: Vec3, prevDirection: Vec3, prevNormal: Vec3, nextDirection: Vec3, nextNormal: Vec3, offset: number, miterLimit: number): Vec3 | undefined {
  const prevX = point.x + prevNormal.x * offset;
  const prevY = point.y + prevNormal.y * offset;
  const nextX = point.x + nextNormal.x * offset;
  const nextY = point.y + nextNormal.y * offset;
  const denominator = cross2D(prevDirection.x, prevDirection.y, nextDirection.x, nextDirection.y);
  if (Math.abs(denominator) > epsilon) {
    const t = cross2D(nextX - prevX, nextY - prevY, nextDirection.x, nextDirection.y) / denominator;
    const x = prevX + prevDirection.x * t;
    const y = prevY + prevDirection.y * t;
    const maxMiterLength = Math.abs(offset) * miterLimit;
    const dx = x - point.x;
    const dy = y - point.y;
    if (dx * dx + dy * dy <= maxMiterLength * maxMiterLength) {
      return new Vec3(x, y, point.z);
    }
  }
  return undefined;
}

function appendRoundJoin(geometry: MeshGeometry, center: Vec3, startPoint: Vec3, endPoint: Vec3, turn: number, color: Color): void {
  const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
  const endAngle = Math.atan2(endPoint.y - center.y, endPoint.x - center.x);
  let delta = normalizeAngle(endAngle - startAngle);
  if (turn > 0 && delta < 0) {
    delta += Math.PI * 2;
  } else if (turn < 0 && delta > 0) {
    delta -= Math.PI * 2;
  }
  appendArcFan(geometry, center, startAngle, delta, Vec3.distance(center, startPoint), color);
}

function appendPlanarCaps(geometry: MeshGeometry, strokePoints: readonly Vec3[], segments: readonly PlanarStrokeSegment[], style: StrokeStyle, color: Color): void {
  if (style.lineCap !== Canvas3DLineCap.round) {
    return;
  }
  const halfWidth = style.lineWidth * 0.5;
  appendCircleFill(geometry, strokePoints[0], halfWidth, color);
  appendCircleFill(geometry, strokePoints[segments[segments.length - 1].toIndex], halfWidth, color);
}

function createPlanarOffsetPoint(point: Vec3, normal: Vec3, offset: number): Vec3 {
  return new Vec3(
    point.x + normal.x * offset,
    point.y + normal.y * offset,
    point.z,
  );
}

function appendArcFan(geometry: MeshGeometry, center: Vec3, startAngle: number, delta: number, radius: number, color: Color): void {
  if (radius <= epsilon || Math.abs(delta) <= epsilon) {
    return;
  }
  const segmentCount = Math.max(1, Math.ceil(Math.abs(delta) / roundSegmentRadians));
  let previousPoint = new Vec3(
    center.x + Math.cos(startAngle) * radius,
    center.y + Math.sin(startAngle) * radius,
    center.z,
  );
  for (let iSegment = 1; iSegment <= segmentCount; iSegment++) {
    const angle = startAngle + delta * iSegment / segmentCount;
    const point = new Vec3(
      center.x + Math.cos(angle) * radius,
      center.y + Math.sin(angle) * radius,
      center.z,
    );
    appendTriangle(geometry, center, previousPoint, point, color);
    previousPoint = point;
  }
}

interface DashState {
  readonly pattern: readonly number[];
  patternIndex: number;
  remaining: number;
  drawing: boolean;
}

function createDashState(pattern: readonly number[], lineDashOffset: number): DashState {
  const patternLength = sum(pattern);
  let offset = lineDashOffset % patternLength;
  if (offset < 0) {
    offset += patternLength;
  }

  let patternIndex = 0;
  while (offset >= pattern[patternIndex] && pattern[patternIndex] > 0) {
    offset -= pattern[patternIndex];
    patternIndex = (patternIndex + 1) % pattern.length;
  }

  return {
    pattern,
    patternIndex,
    remaining: pattern[patternIndex] - offset,
    drawing: patternIndex % 2 === 0,
  };
}

function advanceDashState(state: DashState): void {
  state.patternIndex = (state.patternIndex + 1) % state.pattern.length;
  state.remaining = state.pattern[state.patternIndex];
  state.drawing = state.patternIndex % 2 === 0;
}

function setLerpPoint(out: Vec3, from: Vec3, to: Vec3, t: number): Vec3 {
  return out.set(
    from.x + (to.x - from.x) * t,
    from.y + (to.y - from.y) * t,
    from.z + (to.z - from.z) * t,
  );
}

function normalizedStrokePoints(points: readonly Vec3[], closed: boolean): Vec3[] {
  const strokePoints: Vec3[] = [];
  for (const point of points) {
    if (strokePoints.length === 0 || hasStrokeSegmentLength(strokePoints[strokePoints.length - 1], point)) {
      strokePoints.push(point);
    }
  }
  if (closed && strokePoints.length > 1 && !hasStrokeSegmentLength(strokePoints[strokePoints.length - 1], strokePoints[0])) {
    strokePoints.pop();
  }
  return strokePoints;
}

function isPlanarXY(points: readonly Vec3[]): boolean {
  const firstPoint = points[0];
  if (!firstPoint) {
    return true;
  }
  for (const point of points) {
    if (Math.abs(point.z - firstPoint.z) > epsilon) {
      return false;
    }
  }
  return true;
}

function cross2D(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function appendVertex(geometry: MeshGeometry, point: Vec3, color: Color): number {
  const vertexIndex = geometry.vertices.length / vertexStrideF;
  geometry.vertices.push(
    point.x,
    point.y,
    point.z,
    color.x,
    color.y,
    color.z,
    color.w,
  );
  return vertexIndex;
}

function appendTriangle(geometry: MeshGeometry, a: Vec3, b: Vec3, c: Vec3, color: Color): void {
  const baseVertex = geometry.vertices.length / vertexStrideF;
  appendVertex(geometry, a, color);
  appendVertex(geometry, b, color);
  appendVertex(geometry, c, color);
  geometry.indices.push(baseVertex, baseVertex + 1, baseVertex + 2);
}

function appendQuad(geometry: MeshGeometry, a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: Color): void {
  const baseVertex = geometry.vertices.length / vertexStrideF;
  appendVertex(geometry, a, color);
  appendVertex(geometry, b, color);
  appendVertex(geometry, c, color);
  appendVertex(geometry, d, color);
  geometry.indices.push(
    baseVertex,
    baseVertex + 1,
    baseVertex + 2,
    baseVertex,
    baseVertex + 2,
    baseVertex + 3,
  );
}

export function createOrUpdateRenderingSubMeshRecord(device: gfx.Device, geometry: MeshGeometry, record?: RenderingSubMeshRecord): RenderingSubMeshRecord | undefined {
  const vertexCount = geometry.vertices.length / vertexStrideF;
  if (vertexCount === 0 || geometry.indices.length === 0) {
    return undefined;
  }

  const vertexBufferData = Float32Array.from(geometry.vertices);
  const indexBufferData = createIndexBufferData(geometry.indices, vertexCount);

  if (record && record.indexBytesPerElement === indexBufferData.BYTES_PER_ELEMENT) {
    updateRenderingSubMeshRecord(record, vertexBufferData, indexBufferData);
    return record;
  }

  record?.renderingSubMesh.destroy();
  const vertexBuffer = device.createBuffer(new gfx.BufferInfo(
    gfx.BufferUsageBit.VERTEX,
    gfx.MemoryUsageBit.DEVICE,
    vertexBufferData.byteLength,
    Float32Array.BYTES_PER_ELEMENT * vertexStrideF,
    gfx.BufferFlagBit.NONE,
  ));
  updateGfxBuffer(vertexBuffer, vertexBufferData);

  const indexBuffer = device.createBuffer(new gfx.BufferInfo(
    gfx.BufferUsageBit.INDEX,
    gfx.MemoryUsageBit.DEVICE,
    indexBufferData.byteLength,
    indexBufferData.BYTES_PER_ELEMENT,
    gfx.BufferFlagBit.NONE,
  ));
  updateGfxBuffer(indexBuffer, indexBufferData);

  return {
    renderingSubMesh: new RenderingSubMesh(
      [vertexBuffer],
      canvas3DVertexAttributes,
      gfx.PrimitiveMode.TRIANGLE_LIST,
      indexBuffer,
      null,
      true,
    ),
    vertexBuffer,
    indexBuffer,
    vertexBufferBytes: vertexBufferData.byteLength,
    indexBufferBytes: indexBufferData.byteLength,
    indexBytesPerElement: indexBufferData.BYTES_PER_ELEMENT,
  };
}

function updateRenderingSubMeshRecord(record: RenderingSubMeshRecord, vertexBufferData: Float32Array, indexBufferData: Uint16Array | Uint32Array): void {
  resizeGfxBuffer(record.vertexBuffer, vertexBufferData.byteLength);
  updateGfxBuffer(record.vertexBuffer, vertexBufferData);
  record.vertexBufferBytes = vertexBufferData.byteLength;

  resizeGfxBuffer(record.indexBuffer, indexBufferData.byteLength);
  updateGfxBuffer(record.indexBuffer, indexBufferData);
  record.indexBufferBytes = indexBufferData.byteLength;
}

function resizeGfxBuffer(buffer: gfx.Buffer, byteLength: number): void {
  const resizableBuffer = buffer as gfx.Buffer & {
    readonly size: number;
    resize(size: number): void;
  };
  if (resizableBuffer.size !== byteLength) {
    resizableBuffer.resize(byteLength);
  }
}

function updateGfxBuffer(buffer: gfx.Buffer, source: gfx.BufferSource | ArrayBufferView): void {
  buffer.update(source as gfx.BufferSource);
}

function createIndexBufferData(indices: readonly number[], vertexCount: number): Uint16Array | Uint32Array {
  if (vertexCount > 2 ** 16) {
    return Uint32Array.from(indices);
  }
  return Uint16Array.from(indices);
}

function normalizedSubPathPoints(subPath: SubPath): Vec3[] {
  const points = subPath.points;
  if (points.length > 1 && Vec3.equals(points[0], points[points.length - 1], epsilon)) {
    return points.slice(0, -1);
  }
  return points;
}

export function resolveHalfExtents(halfExtents: number | Vec3): Vec3 {
  if (typeof halfExtents === 'number') {
    return new Vec3(halfExtents, halfExtents, halfExtents);
  }
  return halfExtents.clone();
}

function createBoxCorners(center: Vec3, halfExtents: Vec3): Vec3[] {
  const { x, y, z } = halfExtents;
  return [
    new Vec3(center.x - x, center.y - y, center.z - z),
    new Vec3(center.x + x, center.y - y, center.z - z),
    new Vec3(center.x + x, center.y + y, center.z - z),
    new Vec3(center.x - x, center.y + y, center.z - z),
    new Vec3(center.x - x, center.y - y, center.z + z),
    new Vec3(center.x + x, center.y - y, center.z + z),
    new Vec3(center.x + x, center.y + y, center.z + z),
    new Vec3(center.x - x, center.y + y, center.z + z),
  ];
}

function transformPoint(point: Vec3, transform: Mat4): Vec3 {
  return transformPointInto(new Vec3(), point, transform);
}

function transformPointInto(out: Vec3, point: Vec3, transform: Mat4): Vec3 {
  return Vec3.transformMat4(out, point, transform);
}

function transformPoints(points: readonly Vec3[], transform: Mat4): Vec3[] {
  return points.map((point) => {
    return transformPoint(point, transform);
  });
}

function createAxisBasis(from: Vec3, to: Vec3): {
  readonly normalA: Vec3;
  readonly normalB: Vec3;
} | undefined {
  const direction = Vec3.subtract(new Vec3(), to, from);
  return createDirectionBasis(direction);
}

function createDirectionBasis(direction: Vec3): {
  readonly normalA: Vec3;
  readonly normalB: Vec3;
} | undefined {
  const normalizedDirection = direction.clone();
  if (normalizedDirection.lengthSqr() <= epsilon) {
    return undefined;
  }
  normalizedDirection.normalize();
  const referenceAxis = Math.abs(Vec3.dot(normalizedDirection, Vec3.UP)) > 0.95 ? Vec3.RIGHT : Vec3.UP;
  const normalA = Vec3.cross(new Vec3(), normalizedDirection, referenceAxis).normalize();
  const normalB = Vec3.cross(new Vec3(), normalizedDirection, normalA).normalize();
  return {
    normalA,
    normalB,
  };
}

function createNormalBasis(normal: Vec3): {
  readonly axisA: Vec3;
  readonly axisB: Vec3;
} {
  const direction = resolveDirection(normal, new Vec3(0, 0, 1));

  const referenceAxis = Math.abs(Vec3.dot(direction, Vec3.UP)) > 0.95 ? Vec3.RIGHT : Vec3.UP;
  const axisA = Vec3.cross(new Vec3(), referenceAxis, direction).normalize();
  const axisB = Vec3.cross(new Vec3(), direction, axisA).normalize();
  return {
    axisA,
    axisB,
  };
}

function resolveDirection(value: Vec3, fallback: Vec3 = Vec3.UP): Vec3 {
  const result = value.clone();
  if (result.lengthSqr() <= epsilon) {
    result.set(fallback);
  } else {
    result.normalize();
  }
  return result;
}

function setBasisDirection(out: Vec3, axisA: Vec3, axisB: Vec3, angle: number): Vec3 {
  return out.set(
    axisA.x * Math.cos(angle) + axisB.x * Math.sin(angle),
    axisA.y * Math.cos(angle) + axisB.y * Math.sin(angle),
    axisA.z * Math.cos(angle) + axisB.z * Math.sin(angle),
  );
}

function setHemispherePoint(out: Vec3, center: Vec3, radius: number, axis: Vec3, radialDirection: Vec3, theta: number): Vec3 {
  const radialScale = Math.sin(theta) * radius;
  const axisScale = Math.cos(theta) * radius;
  return out.set(
    center.x + axis.x * axisScale + radialDirection.x * radialScale,
    center.y + axis.y * axisScale + radialDirection.y * radialScale,
    center.z + axis.z * axisScale + radialDirection.z * radialScale,
  );
}

function createVec3Cache(size: number): Vec3ScratchCache {
  return {
    values: createVec3ScratchValues(size),
    borrowed: false,
  };
}

function borrowVec3ScratchCache(cache: Vec3ScratchCache): Vec3[] {
  if (cache.borrowed) {
    throw new Error('Canvas3D Vec3 scratch cache is already borrowed.');
  }
  cache.borrowed = true;
  return cache.values;
}

function releaseVec3ScratchCache(cache: Vec3ScratchCache): void {
  cache.borrowed = false;
}

function createVec3ScratchValues(size: number): Vec3[] {
  return Array.from({ length: size }, () => {
    return new Vec3();
  });
}

function getCircleTopology(segments: number): CircleTopology {
  let topology = circleTopologyCache.get(segments);
  if (!topology) {
    const cos: number[] = [];
    const sin: number[] = [];
    for (let iPoint = 0; iPoint < segments; iPoint++) {
      const angle = iPoint / segments * Math.PI * 2;
      cos.push(Math.cos(angle));
      sin.push(Math.sin(angle));
    }
    topology = { cos, sin };
    circleTopologyCache.set(segments, topology);
  }
  return topology;
}

function getSphereTopology(latitudeSegments: number, longitudeSegments: number): SphereTopology {
  const key = `${latitudeSegments}:${longitudeSegments}`;
  let topology = sphereTopologyCache.get(key);
  if (!topology) {
    const positions: number[] = [];
    const indices: number[] = [];
    for (let iLatitude = 0; iLatitude <= latitudeSegments; iLatitude++) {
      const theta = iLatitude / latitudeSegments * Math.PI;
      const z = Math.cos(theta);
      const ringRadius = Math.sin(theta);
      for (let iLongitude = 0; iLongitude <= longitudeSegments; iLongitude++) {
        const phi = iLongitude / longitudeSegments * Math.PI * 2;
        positions.push(
          Math.cos(phi) * ringRadius,
          Math.sin(phi) * ringRadius,
          z,
        );
      }
    }

    const ringStride = longitudeSegments + 1;
    for (let iLatitude = 0; iLatitude < latitudeSegments; iLatitude++) {
      for (let iLongitude = 0; iLongitude < longitudeSegments; iLongitude++) {
        const a = iLatitude * ringStride + iLongitude;
        const b = a + ringStride;
        const c = b + 1;
        const d = a + 1;
        indices.push(a, b, d, d, b, c);
      }
    }

    topology = { positions, indices };
    sphereTopologyCache.set(key, topology);
  }
  return topology;
}

function getCylinderIndexTopology(radialSegments: number, includeCaps: boolean): CylinderIndexTopology {
  const key = `${radialSegments}:${includeCaps ? 1 : 0}`;
  let topology = cylinderIndexTopologyCache.get(key);
  if (!topology) {
    const indices: number[] = [];
    for (let iPoint = 0; iPoint < radialSegments; iPoint++) {
      const nextPoint = (iPoint + 1) % radialSegments;
      const start = iPoint;
      const startNext = nextPoint;
      const end = radialSegments + iPoint;
      const endNext = radialSegments + nextPoint;
      indices.push(start, end, startNext, startNext, end, endNext);
    }

    if (includeCaps) {
      const fromCenter = radialSegments * 2;
      const toCenter = fromCenter + 1;
      for (let iPoint = 0; iPoint < radialSegments; iPoint++) {
        const nextPoint = (iPoint + 1) % radialSegments;
        indices.push(
          fromCenter,
          nextPoint,
          iPoint,
          toCenter,
          radialSegments + iPoint,
          radialSegments + nextPoint,
        );
      }
    }

    topology = { indices };
    cylinderIndexTopologyCache.set(key, topology);
  }
  return topology;
}

function getHemisphereTopology(radialSegments: number, capSegments: number): HemisphereTopology {
  const key = `${radialSegments}:${capSegments}`;
  let topology = hemisphereTopologyCache.get(key);
  if (!topology) {
    const positions: number[] = [];
    const indices: number[] = [];
    for (let iCap = 0; iCap <= capSegments; iCap++) {
      const theta = iCap / capSegments * Math.PI * 0.5;
      const radialScale = Math.sin(theta);
      const axisScale = Math.cos(theta);
      for (let iRadial = 0; iRadial <= radialSegments; iRadial++) {
        const phi = iRadial / radialSegments * Math.PI * 2;
        positions.push(
          Math.cos(phi) * radialScale,
          Math.sin(phi) * radialScale,
          axisScale,
        );
      }
    }

    const ringStride = radialSegments + 1;
    for (let iCap = 0; iCap < capSegments; iCap++) {
      for (let iRadial = 0; iRadial < radialSegments; iRadial++) {
        const a = iCap * ringStride + iRadial;
        const b = a + ringStride;
        const c = b + 1;
        const d = a + 1;
        indices.push(a, b, d, d, b, c);
      }
    }

    topology = { positions, indices };
    hemisphereTopologyCache.set(key, topology);
  }
  return topology;
}

function appendTopologyIndices(geometry: MeshGeometry, baseVertex: number, indices: readonly number[]): void {
  for (const index of indices) {
    geometry.indices.push(baseVertex + index);
  }
}

function createCirclePoint(center: Vec3, radius: number, pointIndex: number): Vec3 {
  return setCirclePoint(new Vec3(), center, radius, pointIndex);
}

function createCirclePoints(center: Vec3, radius: number): Vec3[] {
  const points: Vec3[] = [];
  for (let iPoint = 0; iPoint < defaultCircleSegments; iPoint++) {
    points.push(createCirclePoint(center, radius, iPoint));
  }
  return points;
}

function setCirclePoint(out: Vec3, center: Vec3, radius: number, pointIndex: number): Vec3 {
  const topology = getCircleTopology(defaultCircleSegments);
  return out.set(
    center.x + topology.cos[pointIndex] * radius,
    center.y + topology.sin[pointIndex] * radius,
    center.z,
  );
}

function createPlaneCirclePoint(center: Vec3, radius: number, axisA: Vec3, axisB: Vec3, pointIndex: number, segmentCount: number): Vec3 {
  return setPlaneCirclePoint(new Vec3(), center, radius, axisA, axisB, pointIndex, segmentCount);
}

function setPlaneCirclePoint(out: Vec3, center: Vec3, radius: number, axisA: Vec3, axisB: Vec3, pointIndex: number, segmentCount: number): Vec3 {
  const topology = getCircleTopology(segmentCount);
  const cos = topology.cos[pointIndex];
  const sin = topology.sin[pointIndex];
  return out.set(
    center.x + (axisA.x * cos + axisB.x * sin) * radius,
    center.y + (axisA.y * cos + axisB.y * sin) * radius,
    center.z + (axisA.z * cos + axisB.z * sin) * radius,
  );
}

export function normalizeArcDelta(startAngle: number, endAngle: number, counterclockwise: boolean): number {
  const fullTurn = Math.PI * 2;
  let delta = endAngle - startAngle;
  if (counterclockwise) {
    while (delta > 0) {
      delta -= fullTurn;
    }
    return Math.max(delta, -fullTurn);
  }

  while (delta < 0) {
    delta += fullTurn;
  }
  return Math.min(delta, fullTurn);
}

function normalizeAngle(value: number): number {
  let result = value;
  while (result <= -Math.PI) {
    result += Math.PI * 2;
  }
  while (result > Math.PI) {
    result -= Math.PI * 2;
  }
  return result;
}

function sum(values: readonly number[]): number {
  let result = 0;
  for (const value of values) {
    result += value;
  }
  return result;
}

const canvas3DVertexAttributes = [
  new gfx.Attribute(
    gfx.AttributeName.ATTR_POSITION,
    gfx.Format.RGB32F,
    false,
    undefined,
    false,
    undefined,
  ),
  new gfx.Attribute(
    gfx.AttributeName.ATTR_COLOR,
    gfx.Format.RGBA32F,
    false,
    undefined,
    false,
    undefined,
  ),
];

const boxEdges = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
] as const;

const boxTriangleIndices = [
  0, 2, 1,
  0, 3, 2,
  4, 5, 6,
  4, 6, 7,
  0, 4, 7,
  0, 7, 3,
  1, 2, 6,
  1, 6, 5,
  0, 1, 5,
  0, 5, 4,
  3, 7, 6,
  3, 6, 2,
] as const;

const strokeBoxTriangleIndices = [
  0, 1, 5,
  0, 5, 4,
  1, 2, 6,
  1, 6, 5,
  2, 3, 7,
  2, 7, 6,
  3, 0, 4,
  3, 4, 7,
  0, 2, 1,
  0, 3, 2,
  4, 5, 6,
  4, 6, 7,
] as const;
