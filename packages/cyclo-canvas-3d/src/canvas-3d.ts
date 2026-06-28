import { gfx, Material, renderer } from 'cc';
import type { Node, Vec3 } from 'cc';

import {
  appendMeshGeometry,
  createOrUpdateRenderingSubMeshRecord,
  defaultDrawOptions,
  getMaterialKey,
  hasGeometry,
} from './geometry.js';
import type {
  Canvas3DOptions,
  Canvas3DW2,
  Canvas3DW3,
  DrawCommand,
  DrawOptions,
  EnqueueGeometry,
  RenderingDrawCommand,
  RenderingSubMeshRecord,
  RenderRecord,
} from './types.js';
import { Canvas3DW2Impl } from './w2.js';
import { Canvas3DW3Impl } from './w3.js';

export { Canvas3DLineCap, Canvas3DLineJoin } from './types.js';
export type {
  Canvas3DBoxOptions,
  Canvas3DCapsuleOptions,
  Canvas3DCylinderOptions,
  Canvas3DDiscOptions,
  Canvas3DLineOptions,
  Canvas3DOptions,
  Canvas3DPrimitiveMode,
  Canvas3DPrimitiveOptions,
  Canvas3DQuadOptions,
  Canvas3DRingOptions,
  Canvas3DSphereOptions,
  Canvas3DW2,
  Canvas3DW3,
  Canvas3DW3Scope,
} from './types.js';

export class Canvas3D {
  constructor(opts: Canvas3DOptions) {
    this._node = opts.node;
    this._w2 = new Canvas3DW2Impl(this._enqueueGeometry);
    this._w3 = new Canvas3DW3Impl(this._enqueueGeometry);
  }

  get w2(): Canvas3DW2 {
    return this._w2;
  }

  get w3(): Canvas3DW3 {
    return this._w3;
  }

  get lineWidth() {
    return this._w2.lineWidth;
  }

  set lineWidth(value) {
    this._w2.lineWidth = value;
  }

  get strokeWidth() {
    return this._w2.strokeWidth;
  }

  set strokeWidth(value) {
    this._w2.strokeWidth = value;
  }

  get lineJoin() {
    return this._w2.lineJoin;
  }

  set lineJoin(value) {
    this._w2.lineJoin = value;
  }

  get lineCap() {
    return this._w2.lineCap;
  }

  set lineCap(value) {
    this._w2.lineCap = value;
  }

  get miterLimit() {
    return this._w2.miterLimit;
  }

  set miterLimit(value) {
    this._w2.miterLimit = value;
  }

  get lineDash() {
    return this.getLineDash();
  }

  set lineDash(value) {
    this.setLineDash(value);
  }

  get lineDashOffset() {
    return this._w2.lineDashOffset;
  }

  set lineDashOffset(value) {
    this._w2.lineDashOffset = value;
  }

  get strokeColor() {
    return this._w2.strokeColor;
  }

  set strokeColor(value) {
    this._w2.strokeColor = value;
  }

  get fillColor() {
    return this._w2.fillColor;
  }

  set fillColor(value) {
    this._w2.fillColor = value;
  }

  beginPath(): this {
    this._w2.beginPath();
    return this;
  }

  closePath(): this {
    this._w2.closePath();
    return this;
  }

  moveTo(point: Vec3): this;
  moveTo(x: number, y: number, z?: number): this;
  moveTo(pointOrX: Vec3 | number, y?: number, z?: number): this {
    if (typeof pointOrX === 'number') {
      this._w2.moveTo(pointOrX, y ?? 0, z);
    } else {
      this._w2.moveTo(pointOrX);
    }
    return this;
  }

  lineTo(point: Vec3): this;
  lineTo(x: number, y: number, z?: number): this;
  lineTo(pointOrX: Vec3 | number, y?: number, z?: number): this {
    if (typeof pointOrX === 'number') {
      this._w2.lineTo(pointOrX, y ?? 0, z);
    } else {
      this._w2.lineTo(pointOrX);
    }
    return this;
  }

  ray(dir: Vec3, length: number): this {
    this._w2.ray(dir, length);
    return this;
  }

  box(center: Vec3, halfExtents: number | Vec3): this {
    this._w2.box(center, halfExtents);
    return this;
  }

  circle(center: Vec3, radius: number): this {
    this._w2.circle(center, radius);
    return this;
  }

  stroke(): this {
    this._w2.stroke();
    return this;
  }

  fill(): this {
    this._w2.fill();
    return this;
  }

  getLineDash(): number[] {
    return this._w2.getLineDash();
  }

  setLineDash(value: readonly number[]): void {
    this._w2.setLineDash(value);
  }

  /**
   * 渲染当前画布。通常在帧结束时调用。
   */
  commit(): void {
    const renderScene = this._node.scene?.renderScene;
    if (!renderScene) {
      this._destroyRenderRecord();
      this._clearPendingDraws();
      return;
    }

    const canReuseRenderRecord = this._canReuseRenderRecord(renderScene);
    if (!canReuseRenderRecord) {
      this._destroyRenderRecord();
    }

    const renderingDrawCommands = this._createRenderingDrawCommands(
      renderScene.root.device,
      canReuseRenderRecord ? this._renderRecord?.renderingSubMeshRecords : undefined,
    );
    if (renderingDrawCommands.length === 0) {
      this._destroyRenderRecord();
      this._clearPendingDraws();
      return;
    }

    const model = canReuseRenderRecord ? this._renderRecord!.model : new renderer.scene.Model();
    model.node = this._node;
    model.transform = this._node;
    model.visFlags = this._node.layer;

    renderingDrawCommands.forEach((drawCommand, iSubModel) => {
      model.initSubModel(iSubModel, drawCommand.renderingSubMeshRecord.renderingSubMesh, drawCommand.material);
    });
    if (!canReuseRenderRecord) {
      renderScene.addModel(model);
    }

    this._renderRecord = {
      renderScene,
      renderingSubMeshRecords: renderingDrawCommands.map((drawCommand) => {
        return drawCommand.renderingSubMeshRecord;
      }),
      model,
    };
    this._clearPendingDraws();
  }

  destroy(): void {
    this._destroyRenderRecord();
    for (const material of this._materials.values()) {
      material.destroy();
    }
    this._materials.clear();
  }

  private readonly _node: Node;
  private readonly _w2: Canvas3DW2Impl;
  private readonly _w3: Canvas3DW3Impl;
  private readonly _drawCommands: DrawCommand[] = [];
  private readonly _materials: Map<string, Material> = new Map();
  private _renderRecord: RenderRecord | undefined = undefined;

  private readonly _enqueueGeometry: EnqueueGeometry = (geometry, options = defaultDrawOptions) => {
    if (!hasGeometry(geometry)) {
      return;
    }

    const lastDrawCommand = this._drawCommands[this._drawCommands.length - 1];
    if (lastDrawCommand && drawOptionsEqual(lastDrawCommand, options)) {
      appendMeshGeometry(lastDrawCommand.geometry, geometry);
      return;
    }

    this._drawCommands.push({
      geometry,
      depthTest: options.depthTest,
      depthWrite: options.depthWrite,
    });
  };

  private _getMaterial(options: DrawOptions): Material {
    const materialKey = getMaterialKey(options);
    let material = this._materials.get(materialKey);
    if (!material) {
      material = new Material();
      material.reset({
        effectName: 'builtin-unlit',
        defines: {
          USE_VERTEX_COLOR: true,
        },
        states: {
          rasterizerState: {
            cullMode: gfx.CullMode.NONE,
          },
          depthStencilState: {
            depthTest: options.depthTest,
            depthWrite: options.depthWrite,
          },
        },
      });
      this._materials.set(materialKey, material);
    }
    return material;
  }

  private _canReuseRenderRecord(renderScene: renderer.RenderScene): boolean {
    return this._renderRecord !== undefined
      && this._renderRecord.renderScene === renderScene
      && this._renderRecord.renderingSubMeshRecords.length === this._drawCommands.length;
  }

  private _createRenderingDrawCommands(device: gfx.Device, reusableSubMeshRecords: readonly RenderingSubMeshRecord[] | undefined): RenderingDrawCommand[] {
    const renderingDrawCommands: RenderingDrawCommand[] = [];
    for (let iDrawCommand = 0; iDrawCommand < this._drawCommands.length; iDrawCommand++) {
      const drawCommand = this._drawCommands[iDrawCommand];
      const subMeshRecord = createOrUpdateRenderingSubMeshRecord(device, drawCommand.geometry, reusableSubMeshRecords?.[iDrawCommand]);
      if (subMeshRecord) {
        renderingDrawCommands.push({
          renderingSubMeshRecord: subMeshRecord,
          material: this._getMaterial(drawCommand),
        });
      }
    }
    return renderingDrawCommands;
  }

  private _destroyRenderRecord(): void {
    if (!this._renderRecord) {
      return;
    }

    const {
      renderScene,
      renderingSubMeshRecords,
      model,
    } = this._renderRecord;
    this._renderRecord = undefined;
    renderScene.removeModel(model);
    for (const record of renderingSubMeshRecords) {
      record.renderingSubMesh.destroy();
    }
    model.destroy();
  }

  private _clearPendingDraws(): void {
    this._drawCommands.length = 0;
    this._w2.beginPath();
  }
}

function drawOptionsEqual(a: DrawOptions, b: DrawOptions): boolean {
  return a.depthTest === b.depthTest && a.depthWrite === b.depthWrite;
}
