import { Vec2 } from './vec2.ts';

export class Ray2D {
  constructor(origin: Vec2, direction: Vec2) {
    this.origin = origin.clone();
    this.direction = direction.normalize();
  }

  get origin() {
    return this._origin;
  }

  set origin(origin: Vec2) {
    Vec2.assign(this._origin, origin);
  }

  get direction() {
    return this._direction;
  }

  set direction(direction: Vec2) {
    Vec2.assign(this._direction, direction);
    this._direction.normalizeSelf();
  }

  at(distance: number) {
    return this.origin.addMulScalar(this.direction, distance);
  }

  private _origin = new Vec2();

  private _direction = new Vec2();
}
