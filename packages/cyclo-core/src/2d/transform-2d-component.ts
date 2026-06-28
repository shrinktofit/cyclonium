import { Quat, Vec3 } from 'cc';
import { editable, cycloBuiltinClass } from '../decorator/legacy/legacy-decorator.ts';
import { CycloComponent } from '../framework/component.ts';
import { Mat3 } from '../math/mat3.ts';
import { mat3FromSRT } from '../math/transform-2d.ts';
import { Vec2 } from '../math/vec2.ts';
import { to0ToPI2 } from '../math/trigonometry.ts';
import { logger } from '../utils/logger.ts';
import { clamp } from '../math/number.ts';

export enum TransformFlag {
  position = 1 << 0,
  rotation = 1 << 1,
  scale = 1 << 2,
}

class TransformChangeFlags {
  get token() {
    return this._token;
  }

  frontValue = 0;

  get backValue() {
    return this._backValue;
  }

  reset() {
    this._token = !this._token;
    this._backValue = this.frontValue;
    this.frontValue = 0;
  }

  private _token = false;
  private _backValue = 0;
}

export class TransformChangeFlagsObserver {
  observe(transform: Transform2DComponent) {
    const flags = transform.changeFlags;
    this._token = flags.token;
    this._flags = flags;
  }

  sync() {
    if (this._token === this._flags.token) {
      return this._flags.frontValue;
    } else {
      this._token = this._flags.token;
      return this._flags.backValue | this._flags.frontValue;
    }
  }

  private _token = false;
  private _flags = new TransformChangeFlags();
}

@cycloBuiltinClass('Transform2DComponent')
export class Transform2DComponent extends CycloComponent {
  static DEFAULT_FORWARD = Vec2.UNIT_X;

  static DEFAULT_UP = Vec2.UNIT_Y;

  static DEFAULT_RIGHT = Vec2.UNIT_X;

  get position() {
    return Vec2.set(this._position, this.node.worldPosition.x, this.node.worldPosition.y);
  }

  set position(value) {
    Vec2.assign(this._position, value);
    this.node.worldPosition = new Vec3(value.x, value.y, this.node.worldPosition.z);
    this._setChangeFlag(TransformFlag.position);
  }

  get x() {
    return this.node.worldPosition.x;
  }

  set x(value) {
    this.node.worldPosition = new Vec3(value, this.node.worldPosition.y, this.node.worldPosition.z);
    this._setChangeFlag(TransformFlag.position);
  }

  get y() {
    return this.node.worldPosition.y;
  }

  set y(value) {
    this.node.worldPosition = new Vec3(this.node.worldPosition.x, value, this.node.worldPosition.z);
    this._setChangeFlag(TransformFlag.position);
  }

  @editable
  get localPosition() {
    return Vec2.set(this._localPosition, this.node.position.x, this.node.position.y);
  }

  set localPosition(value) {
    Vec2.assign(this._localPosition, value);
    this.node.position = new Vec3(value.x, value.y, this.node.position.z);
    this._setChangeFlag(TransformFlag.position);
  }

  get localX() {
    return this.node.position.x;
  }

  set localX(value) {
    this.node.position = new Vec3(value, this.node.position.y, this.node.position.z);
    this._setChangeFlag(TransformFlag.position);
  }

  get localY() {
    return this.node.position.y;
  }

  set localY(value) {
    this.node.position = new Vec3(this.node.position.x, value, this.node.position.z);
    this._setChangeFlag(TransformFlag.position);
  }

  get rotation() {
    return to0ToPI2(getZRotation(this.node.worldRotation));
  }

  set rotation(value) {
    this.node.worldRotation = Quat.fromAxisAngle(new Quat(), Vec3.UNIT_Z, value);
    this._setChangeFlag(TransformFlag.rotation);
  }

  @editable({ radian: true })
  get localRotation() {
    return to0ToPI2(getZRotation(this.node.rotation));
  }

  set localRotation(value) {
    this.node.rotation = Quat.fromAxisAngle(new Quat(), Vec3.UNIT_Z, value);
    this._setChangeFlag(TransformFlag.rotation);
  }

  get scale(): Vec2 {
    return Vec2.set(this._scale, this.node.worldScale.x, this.node.worldScale.y);
  }

  set scale(value: Vec2 | number) {
    this.node.worldScale = typeof value === 'number' ? new Vec3(value, value, this.node.worldScale.z) : new Vec3(value.x, value.y, this.node.worldScale.z);
    this._setChangeFlag(TransformFlag.scale);
  }

  @editable
  get localScale(): Vec2 {
    return Vec2.set(this._localScale, this.node.scale.x, this.node.scale.y);
  }

  set localScale(value: Vec2 | number) {
    this.node.scale = typeof value === 'number' ? new Vec3(value, value, this.node.scale.z) : new Vec3(value.x, value.y, this.node.scale.z);
    this._setChangeFlag(TransformFlag.scale);
  }

  get forward() {
    const f = Vec3.transformQuat(new Vec3(), new Vec3(Transform2DComponent.DEFAULT_FORWARD.x, Transform2DComponent.DEFAULT_FORWARD.y, 0), this.node.worldRotation);
    return Vec2.set(this._forward, f.x, f.y);
  }

  set forward(value) {
    const angle = Vec2.signedAngle(Transform2DComponent.DEFAULT_FORWARD, value);
    this.rotation = angle;
  }

  get up() {
    return Transform2DComponent.DEFAULT_UP.rotate(this.rotation);
  }

  set up(value) {
    this.rotation = Vec2.signedAngle(Transform2DComponent.DEFAULT_UP, value);
  }

  get right() {
    return Transform2DComponent.DEFAULT_RIGHT.rotate(this.rotation);
  }

  set right(value) {
    this.rotation = Vec2.signedAngle(Transform2DComponent.DEFAULT_RIGHT, value);
  }

  get matrix() {
    return mat3FromSRT(this.position, this.rotation, this.scale, this._matrix);
  }

  get changeFlags() {
    return this._changeFlags;
  }

  rotateAround(point: Vec2, angle: number) {
    const dx = this.position.x - point.x;
    const dy = this.position.y - point.y;
    const rotatedX = dx * Math.cos(angle) - dy * Math.sin(angle);
    const rotatedY = dx * Math.sin(angle) + dy * Math.cos(angle);
    this.position = new Vec2(point.x + rotatedX, point.y + rotatedY);
    this.rotation += angle;
    this._setChangeFlag(TransformFlag.position | TransformFlag.rotation);
  }

  protected override onFrameEnd(): void {
    this._changeFlags.reset();
  }

  private _position = new Vec2();
  private _scale = new Vec2(1, 1);
  private _localPosition = new Vec2();
  private _localScale = new Vec2(1, 1);

  private _forward = new Vec2();
  private _matrix = new Mat3(Mat3.IDENTITY);
  private _changeFlags = new TransformChangeFlags();

  private _setChangeFlag(mask: TransformFlag) {
    this._changeFlags.frontValue |= mask;
  }
}

function getZRotation(quat: Quat) {
  const { z, w } = quat;
  const halfTheta = Math.acos(clamp(w, -1, 1));
  if (halfTheta === 0) {
    return 0;
  }
  const sinSign = Math.sign(halfTheta);
  const axisSign = sinSign * Math.sign(z);
  return axisSign * halfTheta * 2;
}
