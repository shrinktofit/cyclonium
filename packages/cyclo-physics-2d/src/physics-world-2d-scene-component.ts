import { EDITOR_NOT_IN_PREVIEW } from 'cc/env';
import { editable, executionOrder, idem, serializable } from '@cyclonium/core/legacy-decorator';
import { CycloComponent } from '@cyclonium/core/framework';
import { PhysicsWorld2D } from './physics-world-2d.js';
import { Physics2DDebugger } from '#physics-2d-debugger';
import { PredefinedExecutionOrder } from '@cyclonium/core/framework';
import { director } from 'cc';
import { cycloBuiltinClass } from '@cyclonium/core/internal';
import { Physics2DSettings } from './physics-2d-settings.js';

@cycloBuiltinClass('PhysicsWorld2DSceneComponent')
@executionOrder(PredefinedExecutionOrder.physics)
export class PhysicsWorld2DSceneComponent extends CycloComponent {
  @editable
  @idem
  get debug() {
    return this._debug;
  }

  set debug(v) {
    this._debug = v;
    if (this._physicsDebugger) {
      this._physicsDebugger.destroy();
      this._physicsDebugger = undefined;
    }
    if (v && this._physicsWorld) {
      this._physicsDebugger = new Physics2DDebugger(this._physicsWorld.impl, this.node.scene);
    }
  }

  @editable(Physics2DSettings)
  get settings() {
    return this._settings;
  }

  set settings(value: Physics2DSettings | null) {
    this._settings = value;
  }

  protected override onAwake(): void {
    if (!EDITOR_NOT_IN_PREVIEW) {
      const settings = this._settings ?? new Physics2DSettings();
      this._physicsWorld = new PhysicsWorld2D({
        scene: this.node.scene,
        tags: settings.tags,
        collisionMatrix: settings.collisionMatrix,
        solverMatrix: settings.collisionMatrix,
      });
      if (this._debug) {
        this._physicsDebugger = new Physics2DDebugger(this._physicsWorld.impl, this.node.scene);
      }
      // addFrameTask({
      //   fn: this._updateFrame,
      //   thisArg: this,
      //   priority: TaskPriority.after(TaskPriority.predefined.componentsLateUpdate),
      // });
    }
  }

  protected override onDestroy(): void {
    if (!EDITOR_NOT_IN_PREVIEW) {
      this._physicsDebugger?.destroy();
      this._physicsDebugger = undefined;
      this._physicsWorld?.destroy();
      this._physicsWorld = null;
    }
  }

  protected override onUpdate(deltaTime: number): void {
    this._updateFrame(deltaTime);
  }

  get physicsWorld() {
    return this._physicsWorld;
  }

  private _physicsWorld: PhysicsWorld2D | null = null;

  private _physicsDebugger: Physics2DDebugger | undefined = undefined;

  private _lastUpdateFrame = -1;

  @serializable
  private _debug = false;

  @serializable
  private _settings: Physics2DSettings | null = null;

  private _updateFrame(_deltaTime: number) {
    const world = this._physicsWorld;
    if (!world) {
      return;
    }
    const syncedFrame = ++this._lastUpdateFrame;
    const actualFrame = director.getTotalFrames();
    if (syncedFrame !== actualFrame) {
      this._lastUpdateFrame = actualFrame;
      world.setOutdated();
    }
    world.step(1 / 60);
    this._physicsDebugger?.render();
  }
}
