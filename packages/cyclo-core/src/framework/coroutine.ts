import type { AbortSignal } from '@cyclonium/abort-controller';

/**
 * Frame data passed back when a coroutine resumes.
 */
export interface CoroutineFrame {
  /**
   * Time elapsed since the previous coroutine update, in seconds.
   */
  readonly deltaTime: number;

  /**
   * Time elapsed since this coroutine started, in seconds.
   */
  readonly elapsedTime: number;

  /**
   * Number of coroutine update frames since the owner component started running coroutines.
   */
  readonly frame: number;
}

declare const CoroutineBrand: unique symbol;

/**
 * Handle returned by `startCoroutine`.
 * @description
 * This is an opaque handle. Store it if you need to stop the coroutine later,
 * and pass it back to `stopCoroutine`; do not inspect or construct it yourself.
 */
export interface Coroutine {
  readonly [CoroutineBrand]: never;
}

/**
 * Yield instruction returned by coroutine wait helpers.
 * @description
 * This is an opaque token produced by helpers such as `nextFrame` and `waitFor`.
 * Yield it from a coroutine to tell the scheduler when the coroutine should resume.
 */
export interface CoroutineInstruction {
  readonly __brand: unique symbol;
}

/**
 * Iterator shape accepted by `startCoroutine`.
 * @description
 * A coroutine yields `CoroutineInstruction`, `null`, or `undefined`. When it resumes,
 * the yielded expression receives a `CoroutineFrame` describing the current frame.
 */
export type CoroutineIterator = IterableIterator<CoroutineYield, void, CoroutineFrame>;

/**
 * Predicate evaluated with the current coroutine frame.
 * @param frame - The frame data for the coroutine update being evaluated.
 */
export type CoroutinePredicate = (frame: CoroutineFrame) => boolean;

type CoroutineYield = CoroutineInstruction | null | undefined;

type InternalCoroutineInstruction
  = | NextFrameInstruction
    | WaitForInstruction
    | WaitUntilInstruction
    | WaitWhileInstruction;

enum CoroutineInstructionType {
  nextFrame = 0,
  waitFor = 1,
  waitUntil = 2,
  waitWhile = 3,
}

interface NextFrameInstruction extends CoroutineInstruction {
  readonly type: CoroutineInstructionType.nextFrame;
}

interface WaitForInstruction extends CoroutineInstruction {
  readonly type: CoroutineInstructionType.waitFor;
  readonly seconds: number;
}

interface WaitUntilInstruction extends CoroutineInstruction {
  readonly type: CoroutineInstructionType.waitUntil;
  readonly predicate: CoroutinePredicate;
}

interface WaitWhileInstruction extends CoroutineInstruction {
  readonly type: CoroutineInstructionType.waitWhile;
  readonly predicate: CoroutinePredicate;
}

/**
 * Options used when starting a coroutine.
 */
export interface StartCoroutineOptions {
  /**
   * Abort signal that stops the coroutine when aborted.
   * @description
   * If the signal is already aborted, the coroutine is stopped immediately after creation.
   * Aborting the signal later has the same effect as stopping this coroutine handle.
   */
  readonly signal?: AbortSignal;
}

const NEXT_FRAME_INSTRUCTION = {
  type: CoroutineInstructionType.nextFrame,
} as NextFrameInstruction;

/**
 * Resume the coroutine on the next coroutine update.
 * @returns An opaque instruction to yield from a coroutine.
 */
export function nextFrame(): CoroutineInstruction {
  return NEXT_FRAME_INSTRUCTION;
}

/**
 * Resume the coroutine after at least the given duration.
 * @param seconds - Duration to wait, in seconds. Must be a non-negative finite number.
 * @returns An opaque instruction to yield from a coroutine.
 */
export function waitFor(seconds: number): CoroutineInstruction {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error('seconds must be a non-negative finite number.');
  }

  return {
    type: CoroutineInstructionType.waitFor,
    seconds,
  } as WaitForInstruction;
}

/**
 * Resume the coroutine when the predicate becomes true.
 * @param predicate - Function evaluated each coroutine update with the current frame.
 * @returns An opaque instruction to yield from a coroutine.
 */
export function waitUntil(predicate: CoroutinePredicate): CoroutineInstruction {
  return {
    type: CoroutineInstructionType.waitUntil,
    predicate,
  } as WaitUntilInstruction;
}

/**
 * Resume the coroutine when the predicate becomes false.
 * @param predicate - Function evaluated each coroutine update with the current frame.
 * @returns An opaque instruction to yield from a coroutine.
 */
export function waitWhile(predicate: CoroutinePredicate): CoroutineInstruction {
  return {
    type: CoroutineInstructionType.waitWhile,
    predicate,
  } as WaitWhileInstruction;
}

export class CoroutineRunner {
  start(coroutine: CoroutineIterator, opts?: StartCoroutineOptions): Coroutine {
    const record = new CoroutineRecord(this, coroutine, opts);
    this._records.push(record);
    record.start();
    this._pruneIfNotDeferred();
    return record;
  }

  update(deltaTime: number): void {
    this._frame++;
    this._deltaTime = deltaTime;

    this._beginPruneDeferral();
    try {
      const count = this._records.length;
      for (let i = 0; i < count; i++) {
        this._records[i].update();
      }
    } finally {
      this._endPruneDeferral();
    }
  }

  stop(handle: Coroutine): void {
    stopCoroutine(handle);
    this._pruneIfNotDeferred();
  }

  stopAll(): void {
    this._beginPruneDeferral();
    try {
      const count = this._records.length;
      for (let i = 0; i < count; i++) {
        this._records[i].stop();
      }
    } finally {
      this._endPruneDeferral();
    }
  }

  get frame(): number {
    return this._frame;
  }

  get deltaTime(): number {
    return this._deltaTime;
  }

  get empty(): boolean {
    return this._records.length === 0;
  }

  private _records: CoroutineRecord[] = [];
  private _frame = 0;
  private _deltaTime = 0;
  private _pruneDeferralDepth = 0;

  private _beginPruneDeferral(): void {
    this._pruneDeferralDepth++;
  }

  private _endPruneDeferral(): void {
    this._pruneDeferralDepth--;
    if (this._pruneDeferralDepth === 0) {
      this._prune();
    }
  }

  private _pruneIfNotDeferred(): void {
    if (this._pruneDeferralDepth === 0) {
      this._prune();
    }
  }

  private _prune(): void {
    this._records = this._records.filter((record) => !record.done);
  }
}

export function stopCoroutine(coroutine: Coroutine): void {
  if (coroutine instanceof CoroutineRecord) {
    coroutine.stop();
    return;
  }

  throw new Error('Invalid coroutine handle.');
}

interface MutableCoroutineFrame {
  deltaTime: number;
  elapsedTime: number;
  frame: number;
}

class CoroutineRecord implements Coroutine {
  declare readonly [CoroutineBrand]: never;

  constructor(runner: CoroutineRunner, coroutine: CoroutineIterator, opts?: StartCoroutineOptions) {
    this._runner = runner;
    this._coroutine = coroutine;
    this._signal = opts?.signal;
  }

  get running(): boolean {
    return !this._done && !this._stopping;
  }

  get done(): boolean {
    return this._done;
  }

  start(): void {
    if (this._signal?.aborted) {
      this.stop();
      return;
    }

    this._addAbortListener();
    this._advance();
  }

  update(): void {
    if (!this.running || this._yieldedAtFrame >= this._runner.frame) {
      return;
    }

    this._elapsedTime += this._runner.deltaTime;
    this._frame.deltaTime = this._runner.deltaTime;
    this._frame.elapsedTime = this._elapsedTime;
    this._frame.frame = this._runner.frame;
    if (this._canResume(this._frame)) {
      this._advance(this._frame);
    }
  }

  stop(): void {
    if (this._done) {
      return;
    }

    this._done = true;
    this._removeAbortListener();
    if (this._executing) {
      return;
    }

    this._stopping = true;
    try {
      this._coroutine.return?.(undefined);
    } finally {
      this._stopping = false;
    }
  }

  private readonly _runner: CoroutineRunner;
  private readonly _coroutine: CoroutineIterator;
  private readonly _signal: AbortSignal | undefined;

  private _instruction: InternalCoroutineInstruction = NEXT_FRAME_INSTRUCTION;
  private readonly _frame: MutableCoroutineFrame = {
    deltaTime: 0,
    elapsedTime: 0,
    frame: 0,
  };

  private _yieldedAtFrame = 0;
  private _remainingSeconds = 0;
  private _elapsedTime = 0;
  private _done = false;
  private _executing = false;
  private _stopping = false;

  private _advance(frame?: CoroutineFrame): void {
    let result: IteratorResult<CoroutineYield, void>;
    this._executing = true;
    try {
      result = frame === undefined ? this._coroutine.next() : this._coroutine.next(frame);
    } catch (error) {
      this._done = true;
      this._removeAbortListener();
      throw error;
    } finally {
      this._executing = false;
    }

    if (this._done) {
      return;
    }

    if (result.done === true) {
      this._done = true;
      this._removeAbortListener();
      return;
    }

    this._setInstruction(result.value);
  }

  private _setInstruction(instruction: CoroutineYield): void {
    if (instruction === null || instruction === undefined) {
      this._instruction = NEXT_FRAME_INSTRUCTION;
    } else {
      switch ((instruction as { readonly type?: unknown }).type) {
      case CoroutineInstructionType.nextFrame:
        this._instruction = instruction as NextFrameInstruction;
        break;

      case CoroutineInstructionType.waitFor:
        this._instruction = instruction as WaitForInstruction;
        break;

      case CoroutineInstructionType.waitUntil:
      case CoroutineInstructionType.waitWhile:
        this._instruction = instruction as WaitUntilInstruction | WaitWhileInstruction;
        break;

      default:
        throw new Error('Invalid coroutine instruction.');
      }
    }

    this._yieldedAtFrame = this._runner.frame;

    switch (this._instruction.type) {
    case CoroutineInstructionType.waitFor:
      this._remainingSeconds = this._instruction.seconds;
      break;

    default:
      break;
    }
  }

  private _canResume(frame: CoroutineFrame): boolean {
    switch (this._instruction.type) {
    case CoroutineInstructionType.nextFrame:
      return true;

    case CoroutineInstructionType.waitFor:
      this._remainingSeconds -= frame.deltaTime;
      return this._remainingSeconds <= 0;

    case CoroutineInstructionType.waitUntil:
      return this._instruction.predicate(frame);

    case CoroutineInstructionType.waitWhile:
      return !this._instruction.predicate(frame);
    }
  }

  private _addAbortListener(): void {
    if (!this._signal || this._onAbort) {
      return;
    }

    this._onAbort = () => {
      this.stop();
    };
    this._signal.addEventListener('abort', this._onAbort);
  }

  private _removeAbortListener(): void {
    if (!this._signal || !this._onAbort) {
      return;
    }

    this._signal.removeEventListener('abort', this._onAbort);
    this._onAbort = undefined;
  }

  private _onAbort: (() => void) | undefined = undefined;
}
