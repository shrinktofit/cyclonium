import { HandleContext } from './handle-context.js';
import { Bounds2DHandleProvider } from './handles/bounds-2d-handle.js';
import { PointHandleProvider } from './handles/point-handle.js';
import { Color } from 'cc';
import type { HandleRenderer } from './handle-renderer.js';

export class Handles {
  constructor(...args: ConstructorParameters<typeof HandleContext>) {
    this._handleContext = new HandleContext(...args);
  }

  get input() {
    return this._handleContext.input;
  }

  get color() {
    return this._color;
  }

  set color(value) {
    this._color.set(value);
  }

  destroy_internal() {
    this._handleContext.destroy_internal();
  }

  pushScope(key: string) {
    this._handleContext.pushScope(key);
  }

  popScope() {
    this._handleContext.popScope();
  }

  /**
   * Draw an operable rectangle in scene,
   * will modify the bounds in place according to user operation,
   * @returns true if the rectangle is modified.
   */
  bounds2DHandle(...args: Handles.Slice1<Parameters<Bounds2DHandleProvider['draw']>>): boolean {
    return (this._bounds2DHandleProvider ??= new Bounds2DHandleProvider()).draw(this._handleContext, ...args);
  }

  squaredPoint2DHandle(...args: Handles.Slice1<Parameters<PointHandleProvider['drawSquaredPoint2D']>>): boolean {
    return (this._pointHandleProvider ??= new PointHandleProvider()).drawSquaredPoint2D(this._handleContext, ...args);
  }

  drawLine2D(opt: Omit<Parameters<HandleRenderer['drawLine2D']>[0], 'color'>) {
    this._handleContext.renderer.drawLine2D({
      ...opt,
      color: this._color,
    });
  }

  drawPolyline2D(opt: Omit<Parameters<HandleRenderer['drawPolyline2D']>[0], 'color'>) {
    this._handleContext.renderer.drawPolyline2D({
      ...opt,
      color: this._color,
    });
  }

  drawBox2D(opt: Omit<Parameters<HandleRenderer['drawBox2D']>[0], 'color'>) {
    this._handleContext.renderer.drawBox2D({
      ...opt,
      color: this._color,
    });
  }

  startFrame_internal(opts: HandleContext.FrameStartOptions) {
    this._handleContext.startFrame_internal(opts);
  }

  endFrame_internal() {
    this._handleContext.endFrame_internal();
  }

  private _handleContext: HandleContext;
  private _bounds2DHandleProvider: Bounds2DHandleProvider | undefined;
  private _pointHandleProvider: PointHandleProvider | undefined;
  private readonly _color = Color.WHITE.clone();
}

export declare namespace Handles {
  export type Slice1<T> = T extends readonly [infer _U, ...infer Rest] ? Rest : never;
}
