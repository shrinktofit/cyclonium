export class TimeAccumulator {
  constructor(timeStep: number) {
    this._timeStep = timeStep;
  }

  get timeStep() {
    return this._timeStep;
  }

  /** Adds at most `maxSteps` worth of elapsed time and consumes complete steps. */
  advance(deltaTime: number, maxSteps: number) {
    const timeStep = this._timeStep;
    const maximumDeltaTime = maxSteps * timeStep;
    const acceptedDeltaTime = Math.min(deltaTime, maximumDeltaTime);
    const accumulatedTime = this._accumulatedTime + acceptedDeltaTime;
    const steps = Math.min(countCompleteSteps(accumulatedTime, timeStep), maxSteps);
    this._accumulatedTime = Math.max(accumulatedTime - steps * timeStep, 0);
    return steps;
  }

  reset() {
    this._accumulatedTime = 0;
  }

  private readonly _timeStep: number;

  private _accumulatedTime = 0;
}

function countCompleteSteps(accumulatedTime: number, timeStep: number) {
  const stepRatio = accumulatedTime / timeStep;
  const tolerance = Number.EPSILON * Math.max(Math.abs(stepRatio), 1) * 4;
  return Math.floor(stepRatio + tolerance);
}
