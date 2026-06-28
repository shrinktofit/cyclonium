import { Bounds2D } from '@cyclonium/core/math/bounds-2d';
import { type HandleContext, type HandleKey } from '../handle-context.js';
import { HandleProvider } from '../handle-provider.js';
import { Vec2 } from '@cyclonium/core/math/vec2';
import { Color, geometry, Quat, Vec3 } from 'cc';
import { logger } from '@cyclonium/core/log';
import { HandleMouseButton } from '../handle-input.js';

export class VirtualBox2DHandleProvider extends HandleProvider {
  constructor() {
    super();
  }

  drawVirtualBox(ctx: HandleContext, center: Vec2, opts: {
    size: Vec2;
    rotation?: number;
    style?: {
      color?: Color;
      wireframe?: boolean;
    };
    onMouseEnter?: () => void;
    onMouseExit?: () => void;
    onMouseMove?: () => void;
    onMouseDown?: (button: HandleMouseButton) => void;
    onMouseUp?: (button: HandleMouseButton) => void;
    onWantMove?: (newPosition: Vec2) => void;
  }): boolean {
    const handleKey = ctx.allocateSequentialKey();
    let livingRecord: VirtualBoxRecord;
    const pendingRecord = this._pendingRecords.get(handleKey);
    if (pendingRecord) {
      this._pendingRecords.delete(handleKey);
      livingRecord = pendingRecord;
    } else {
      livingRecord = new VirtualBoxRecord();
      logger.verbose(`Create virtual box handle ${handleKey}`);
    }
    ++livingRecord.liveFrames;
    livingRecord.bounds.setCenterSize(center, opts.size);
    this._livingRecords.set(handleKey, livingRecord);

    const mouseState = livingRecord.mouse;
    for (const [buttonId_, buttonState] of Object.entries(mouseState.buttons)) {
      const buttonId = Number(buttonId_);
      const down = ctx.input.mouseButtonDown(buttonId);
      buttonState.previousDown = buttonState.down;
      if (down !== buttonState.down) {
        buttonState.down = down;
        buttonState.alterTime = ctx.now;
        if (down) {
          opts.onMouseDown?.(buttonId);
        } else {
          opts.onMouseUp?.(buttonId);
        }
      }
    }

    const positionMoved = this._processInput(ctx, livingRecord, center, opts);

    const rotationQuat = opts.rotation
      ? Quat.fromAxisAngle(new Quat(), Vec3.UNIT_Z, opts.rotation)
      : undefined;
    const baseRight = Vec3.UNIT_X;
    const baseUp = Vec3.UNIT_Y;

    ctx.renderer.drawRect({
      center: new Vec3(center.x, center.y, 0),
      halfExtent: opts.size.mulScalar(0.5),
      right: rotationQuat ? Vec3.transformQuat(new Vec3(), baseRight, rotationQuat) : baseRight,
      up: rotationQuat ? Vec3.transformQuat(new Vec3(), baseUp, rotationQuat) : baseUp,
      color: opts.style?.color ?? Color.WHITE,
      unlit: true,
      wireframe: opts.style?.wireframe ?? false,
    });

    if (!this._queuedFrameEndTask) {
      this._queuedFrameEndTask = true;
      ctx.queueFrameEndTask_internal(this._onFrameEnd.bind(this));
    }

    return positionMoved;
  }

  private _livingRecords: Map<HandleKey, VirtualBoxRecord> = new Map();
  private _pendingRecords: Map<HandleKey, VirtualBoxRecord> = new Map();
  private _queuedFrameEndTask = false;

  private _onFrameEnd() {
    this._queuedFrameEndTask = false;
    [this._livingRecords, this._pendingRecords] = [this._pendingRecords, this._livingRecords];
    this._livingRecords.clear();
  }

  private _processInput(ctx: HandleContext, record: VirtualBoxRecord, center: Vec2, opts: Parameters<VirtualBox2DHandleProvider['drawVirtualBox']>[2]) {
    let positionMoved = false;

    const currentMousePosition = ctx.input.mousePosition;

    const mouseRay = ctx.input.mouseRay();
    const mouseState = record.mouse;

    mouseState.position.copyFrom(currentMousePosition);

    if (record.dragRecord.started) {
      if (!mouseState.buttons[HandleMouseButton.left].down) {
        record.dragRecord.started = false;
      } else {
        ctx.input.captureMouse();
        const toi = geometry.intersect.rayPlane(mouseRay, record.dragRecord.startPlane);
        const hasHit = toi !== 0;
        if (hasHit) {
          const hitPoint = new Vec3();
          mouseRay.computeHit(hitPoint, toi);
          opts.onWantMove?.(new Vec2(hitPoint.x, hitPoint.y));
          positionMoved = true;
        }
      }
    } else {
      const aabb = new geometry.AABB();
      aabb.center = new Vec3(center.x, center.y, 0);
      const halfSize = opts.size.mulScalar(0.5);
      aabb.halfExtents = new Vec3(halfSize.x, halfSize.y, 0);
      const toi = geometry.intersect.rayAABB(mouseRay, aabb);
      const entered = toi !== 0;
      if (entered) {
        ctx.input.captureMouse();
        if (!mouseState.entered) {
          opts.onMouseEnter?.();
        }
        const hitPosition = new Vec3();
        mouseRay.computeHit(hitPosition, toi);
        if (mouseState.buttons[HandleMouseButton.left].down && !mouseState.buttons[HandleMouseButton.left].previousDown) {
          record.dragRecord.started = true;
          record.dragRecord.startPosition.set(hitPosition);
          record.dragRecord.startPlane.n.set(mouseRay.d);
          record.dragRecord.startPlane.n.negative();
          record.dragRecord.startPlane.d = Vec3.len(hitPosition);
        }
      } else {
        if (mouseState.entered) {
          opts.onMouseExit?.();
        }
      }
    }

    return positionMoved;
  }
}

class VirtualBoxRecord {
  bounds: Bounds2D = new Bounds2D();

  liveFrames: number = 0;

  mouse: VirtualBoxButtonState = new VirtualBoxButtonState();

  dragRecord: DragRecord = new DragRecord();
}

class DragRecord {
  started: boolean = false;
  startPosition: Vec3 = new Vec3();
  startPlane = new geometry.Plane();
}

class VirtualBoxButtonState {
  entered: boolean = false;
  position: Vec2 = new Vec2();
  buttons: Record<HandleMouseButton, MouseButtonState> = {
    [HandleMouseButton.left]: new MouseButtonState(),
    [HandleMouseButton.right]: new MouseButtonState(),
    [HandleMouseButton.middle]: new MouseButtonState(),
  };
}

class MouseButtonState {
  down: boolean = false;
  alterTime: number = 0;
  previousDown: boolean = false;
}
