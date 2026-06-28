import type { Color, gfx, Mat4, Material, Node, renderer, RenderingSubMesh, Vec2, Vec3 } from 'cc';

export interface Canvas3DOptions {
  readonly node: Node;
}

export enum Canvas3DLineJoin {
  round = 'round',
  bevel = 'bevel',
  miter = 'miter',
}

export enum Canvas3DLineCap {
  butt = 'butt',
  round = 'round',
  square = 'square',
}

export interface SubPath {
  readonly points: Vec3[];
  closed: boolean;
}

export enum PathEntryType {
  subPath = 'subPath',
  box = 'box',
  circle = 'circle',
}

export type PathEntry = {
  readonly type: PathEntryType.subPath;
  readonly subPath: SubPath;
} | {
  readonly type: PathEntryType.box;
  readonly center: Vec3;
  readonly halfExtents: Vec3;
} | {
  readonly type: PathEntryType.circle;
  readonly center: Vec3;
  readonly radius: number;
};

export interface MeshGeometry {
  readonly vertices: number[];
  readonly indices: number[];
}

export interface DrawOptions {
  readonly depthTest: boolean;
  readonly depthWrite: boolean;
}

export interface DrawCommand extends DrawOptions {
  readonly geometry: MeshGeometry;
}

export interface RenderingDrawCommand {
  readonly renderingSubMeshRecord: RenderingSubMeshRecord;
  readonly material: Material;
}

export interface RenderingSubMeshRecord {
  readonly renderingSubMesh: RenderingSubMesh;
  readonly vertexBuffer: gfx.Buffer;
  readonly indexBuffer: gfx.Buffer;
  vertexBufferBytes: number;
  indexBufferBytes: number;
  indexBytesPerElement: number;
}

export interface StrokeStyle {
  readonly lineWidth: number;
  readonly lineJoin: Canvas3DLineJoin;
  readonly lineCap: Canvas3DLineCap;
  readonly miterLimit: number;
  readonly lineDash: readonly number[];
  readonly lineDashOffset: number;
}

export interface StrokeSegmentWriter {
  readonly geometry: MeshGeometry;
  readonly direction: Vec3;
  readonly normalA: Vec3;
  readonly normalB: Vec3;
  vertexOffsetF: number;
  indexOffset: number;
  baseVertex: number;
}

export interface RenderRecord {
  readonly renderScene: renderer.RenderScene;
  readonly renderingSubMeshRecords: RenderingSubMeshRecord[];
  readonly model: renderer.scene.Model;
}

export interface PrimitiveDrawState {
  lineWidth: number;
  lineJoin: Canvas3DLineJoin;
  lineCap: Canvas3DLineCap;
  miterLimit: number;
  lineDash: readonly number[];
  lineDashOffset: number;
  fillColor: Color;
  strokeColor: Color;
  transform: Mat4;
  depthTest: boolean;
  depthWrite: boolean;
}

export type EnqueueGeometry = (geometry: MeshGeometry, options?: DrawOptions) => void;

export type Canvas3DPrimitiveMode = 'wireframe' | 'solid' | 'both';

export interface Canvas3DPrimitiveOptions {
  readonly color?: Readonly<Color> | string;
  readonly strokeColor?: Readonly<Color> | string;
  readonly fillColor?: Readonly<Color> | string;
  readonly lineWidth?: number;
  readonly lineJoin?: Canvas3DLineJoin;
  readonly lineCap?: Canvas3DLineCap;
  readonly lineDash?: readonly number[];
  readonly lineDashOffset?: number;
  readonly transform?: Mat4;
  readonly depthTest?: boolean;
  readonly depthWrite?: boolean;
  readonly mode?: Canvas3DPrimitiveMode;
}

export interface Canvas3DLineOptions extends Canvas3DPrimitiveOptions {
  readonly from: Vec3;
  readonly to: Vec3;
}

export interface Canvas3DBoxOptions extends Canvas3DPrimitiveOptions {
  readonly center: Vec3;
  readonly halfExtents: number | Vec3;
}

export interface Canvas3DQuadOptions extends Canvas3DPrimitiveOptions {
  readonly center: Vec3;
  readonly normal: Vec3;
  readonly halfExtents: number | Vec2;
}

export interface Canvas3DCylinderOptions extends Canvas3DPrimitiveOptions {
  readonly center: Vec3;
  readonly radius: number;
  readonly height: number;
  readonly up?: Vec3;
  readonly radialSegments?: number;
}

export interface Canvas3DDiscOptions extends Canvas3DPrimitiveOptions {
  readonly center: Vec3;
  readonly normal: Vec3;
  readonly radius: number;
  readonly segments?: number;
}

export interface Canvas3DRingOptions extends Canvas3DPrimitiveOptions {
  readonly center: Vec3;
  readonly normal: Vec3;
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly segments?: number;
}

export interface Canvas3DSphereOptions extends Canvas3DPrimitiveOptions {
  readonly center: Vec3;
  readonly radius: number;
  readonly segments?: number;
  readonly latitudeSegments?: number;
  readonly longitudeSegments?: number;
}

export interface Canvas3DCapsuleOptions extends Canvas3DPrimitiveOptions {
  readonly center: Vec3;
  readonly radius: number;
  readonly height: number;
  readonly up?: Vec3;
  readonly radialSegments?: number;
  readonly capSegments?: number;
}

export interface Canvas3DW2 {
  get lineWidth(): number;
  set lineWidth(value: number);
  get strokeWidth(): number;
  set strokeWidth(value: number);
  get lineJoin(): Canvas3DLineJoin;
  set lineJoin(value: Canvas3DLineJoin);
  get lineCap(): Canvas3DLineCap;
  set lineCap(value: Canvas3DLineCap);
  get miterLimit(): number;
  set miterLimit(value: number);
  get lineDash(): number[];
  set lineDash(value: readonly number[]);
  get lineDashOffset(): number;
  set lineDashOffset(value: number);
  get strokeColor(): Color;
  set strokeColor(value: Color);
  get fillColor(): Color;
  set fillColor(value: Color);
  get strokeStyle(): Color;
  set strokeStyle(value: Readonly<Color> | string);
  get fillStyle(): Color;
  set fillStyle(value: Readonly<Color> | string);
  beginPath(): this;
  closePath(): this;
  moveTo(point: Vec3): this;
  moveTo(x: number, y: number, z?: number): this;
  lineTo(point: Vec3): this;
  lineTo(x: number, y: number, z?: number): this;
  rect(x: number, y: number, width: number, height: number, z?: number): this;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean, z?: number): this;
  ray(dir: Vec3, length: number): this;
  box(center: Vec3, halfExtents: number | Vec3): this;
  circle(center: Vec3, radius: number): this;
  stroke(): this;
  fill(): this;
  getLineDash(): number[];
  setLineDash(value: readonly number[]): void;
}

export interface Canvas3DW3 {
  scope(draw: (w3: Canvas3DW3Scope) => void): this;
  line(options: Canvas3DLineOptions): this;
  box(options: Canvas3DBoxOptions): this;
  quad(options: Canvas3DQuadOptions): this;
  cylinder(options: Canvas3DCylinderOptions): this;
  disc(options: Canvas3DDiscOptions): this;
  ring(options: Canvas3DRingOptions): this;
  sphere(options: Canvas3DSphereOptions): this;
  capsule(options: Canvas3DCapsuleOptions): this;
}

export interface Canvas3DW3Scope {
  get lineWidth(): number;
  set lineWidth(value: number);
  get lineJoin(): Canvas3DLineJoin;
  set lineJoin(value: Canvas3DLineJoin);
  get lineCap(): Canvas3DLineCap;
  set lineCap(value: Canvas3DLineCap);
  get lineDash(): number[];
  set lineDash(value: readonly number[]);
  get lineDashOffset(): number;
  set lineDashOffset(value: number);
  get strokeColor(): Color;
  set strokeColor(value: Color);
  get fillColor(): Color;
  set fillColor(value: Color);
  color(value: Readonly<Color> | string): this;
  depthTest(value?: boolean): this;
  depthWrite(value?: boolean): this;
  save(): this;
  restore(): this;
  resetTransform(): this;
  setTransform(transform: Mat4): this;
  transform(transform: Mat4): this;
  translate(x: number, y: number, z?: number): this;
  scale(x: number, y?: number, z?: number): this;
  rotate(rad: number, axis: Vec3): this;
  rotateX(rad: number): this;
  rotateY(rad: number): this;
  rotateZ(rad: number): this;
  line(options: Canvas3DLineOptions): this;
  box(options: Canvas3DBoxOptions): this;
  quad(options: Canvas3DQuadOptions): this;
  cylinder(options: Canvas3DCylinderOptions): this;
  disc(options: Canvas3DDiscOptions): this;
  ring(options: Canvas3DRingOptions): this;
  sphere(options: Canvas3DSphereOptions): this;
  capsule(options: Canvas3DCapsuleOptions): this;
  getLineDash(): number[];
  setLineDash(value: readonly number[]): void;
}
