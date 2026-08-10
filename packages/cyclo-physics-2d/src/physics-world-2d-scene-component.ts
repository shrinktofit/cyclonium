import { EDITOR_NOT_IN_PREVIEW } from 'cc/env';
import { editable, executionOrder, idem, serializable } from '@cyclonium/core/legacy-decorator';
import { CycloComponent, PredefinedExecutionOrder } from '@cyclonium/core/framework';
import { director } from 'cc';
import { cycloBuiltinClass, TimeAccumulator } from '@cyclonium/core/internal';
import { logger } from '@cyclonium/core/log';
import { Physics2DDebugger } from '#physics-2d-debugger';
import { Physics2DSettings } from './physics-2d-settings.js';
import { PhysicsWorld2D } from './physics-world-2d.js';

const getDefaultSettings = (() => {
  let defaultSettings: Physics2DSettings | undefined;
  return () => defaultSettings ??= new Physics2DSettings();
})();

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
      const settings = this._settings ?? getDefaultSettings();
      let fps = settings.fps;
      let maxSubsteps = settings.maxSubsteps;
      if (!Number.isFinite(fps) || fps <= 0) {
        logger.error(`Invalid Physics2DSettings.fps (${fps});`);
        fps = getDefaultSettings().fps;
      }
      if (!Number.isInteger(maxSubsteps) || maxSubsteps <= 0) {
        logger.error(`Invalid Physics2DSettings.maxSubsteps (${maxSubsteps});`);
        maxSubsteps = getDefaultSettings().maxSubsteps;
      }
      this._timeAccumulator = new TimeAccumulator(1 / fps);
      this._maxSubsteps = maxSubsteps;
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

  private _maxSubsteps = 4;

  private _timeAccumulator = new TimeAccumulator(1 / 60);

  private _overloading = false;

  @serializable
  private _debug = false;

  @serializable
  private _settings: Physics2DSettings | null = null;

  private _updateFrame(deltaTime: number) {
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

    const timeAccumulator = this._timeAccumulator;
    const fixedDeltaTime = timeAccumulator.timeStep;
    const maxSubsteps = this._maxSubsteps;
    const actualSubsteps = timeAccumulator.advance(deltaTime, maxSubsteps);
    const maximumDeltaTime = maxSubsteps * fixedDeltaTime;
    const overloading = deltaTime > maximumDeltaTime;

    if (overloading && !this._overloading) {
      logger.warn(
        `PhysicsWorld2D clamped an update to the ${maxSubsteps}-substep limit.`,
      );
    }
    this._overloading = overloading;

    world.advanceSubsteps_internal(fixedDeltaTime, actualSubsteps);
    this._physicsDebugger?.render();
  }
}
