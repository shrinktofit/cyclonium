import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from '../src/index.js';
import { AbortController } from '@cyclonium/abort-controller';
import process from 'node:process';

describe('add and remove', () => {
  it('single', () => {
    const emitter = new EventEmitter();
    const callback = vi.fn();
    emitter.add(callback);

    for (let i = 0; i < 2; ++i) {
      expect(emitter.listenerCount).toBe(1);
      emitter.emit();
      expect(callback).toBeCalledTimes(1);
      callback.mockClear();
    }

    emitter.remove(callback);
    expect(emitter.listenerCount).toBe(0);
    emitter.emit();
    expect(callback).toBeCalledTimes(0);
  });

  it('multiple', () => {
    const emitter = new EventEmitter();
    const callbacks = Array.from({ length: 3 }, () => vi.fn());
    callbacks.forEach((callback, i) => {
      emitter.add(callback);
      expect(emitter.listenerCount).toBe(i + 1);
    });
    for (let i = 0; i < 2; ++i) {
      emitter.emit();
      callbacks.forEach((callback, index) => {
        expect(callback).toBeCalledTimes(1);
        if (index > 0) {
          expect(callback.mock.invocationCallOrder[0]).toBeGreaterThan(callbacks[index - 1].mock.invocationCallOrder[0]);
        }
      });
      callbacks.forEach((callback) => callback.mockClear());
    }
    const [first, middle, last] = callbacks;
    // Remove the middle.
    emitter.remove(middle);
    expect(emitter.listenerCount).toBe(2);
    emitter.emit();
    expect(middle).toBeCalledTimes(0);
    [first, last].forEach((callback) => expect(callback).toBeCalledTimes(1));
    [first, last].forEach((callback) => callback.mockClear());
    // Remove the last.
    emitter.remove(last);
    expect(emitter.listenerCount).toBe(1);
    emitter.emit();
    expect(last).toBeCalledTimes(0);
    expect(first).toBeCalledTimes(1);
    first.mockClear();
    // Remove the first.
    emitter.remove(first);
    expect(emitter.listenerCount).toBe(0);
    emitter.emit();
    expect(first).toBeCalledTimes(0);
  });
});

describe('once', () => {
  it('emit once', () => {
    {
      const emitter = new EventEmitter();
      const callback = vi.fn();
      emitter.add(callback, { once: true });
      expect(emitter.listenerCount).toBe(1);
      emitter.emit();
      expect(callback).toBeCalledTimes(1);
      callback.mockClear();
      emitter.emit();
      expect(callback).toBeCalledTimes(0);
    }

    {
      const persistentCallbackPre = vi.fn();
      const onceCallback = vi.fn();
      const persistentCallbackPost = vi.fn();
      const emitter = new EventEmitter();
      emitter.add(persistentCallbackPre);
      emitter.add(onceCallback, { once: true });
      emitter.add(persistentCallbackPost);
      expect(emitter.listenerCount).toBe(3);
      emitter.emit();
      expect(persistentCallbackPre).toBeCalledTimes(1);
      expect(onceCallback).toBeCalledTimes(1);
      expect(persistentCallbackPost).toBeCalledTimes(1);
      persistentCallbackPre.mockClear();
      onceCallback.mockClear();
      persistentCallbackPost.mockClear();
      emitter.emit();
      expect(persistentCallbackPre).toBeCalledTimes(1);
      expect(onceCallback).toBeCalledTimes(0);
      expect(persistentCallbackPost).toBeCalledTimes(1);
    }
  });

  it('could be removed', () => {
    const emitter = new EventEmitter();
    const callback = vi.fn();
    emitter.add(callback);
    expect(emitter.listenerCount).toBe(1);
    emitter.remove(callback);
    expect(emitter.listenerCount).toBe(0);
    emitter.emit();
    expect(callback).toBeCalledTimes(0);
  });
});

it('remove all', () => {
  const emitter = new EventEmitter();
  const callbacks = Array.from({ length: 3 }, () => vi.fn());
  callbacks.forEach((callback, index) => emitter.add(callback, {
    once: index % 2 === 1,
  }));
  expect(emitter.listenerCount).toBe(3);
  emitter.removeAll();
  expect(emitter.listenerCount).toBe(0);
  emitter.emit();
  callbacks.forEach((callback) => expect(callback).toBeCalledTimes(0));
});

it('repeatedly add', () => {
  const emitter = new EventEmitter();
  const callback = vi.fn();
  {
    emitter.add(callback);
    {
      emitter.add(callback);
      expect(emitter.listenerCount).toBe(1);
      emitter.emit();
      expect(callback).toBeCalledTimes(1);
      callback.mockClear();
    }
    {
      emitter.add(callback, { once: true });
      expect(emitter.listenerCount).toBe(1);
      for (let i = 0; i < 2; ++i) {
        emitter.emit();
        expect(callback).toBeCalledTimes(1);
        callback.mockClear();
      }
    }
  }
  emitter.removeAll();
  {
    {
      emitter.add(callback, { once: true });
      emitter.add(callback, { once: true });
      expect(emitter.listenerCount).toBe(1);
      emitter.emit();
      expect(callback).toBeCalledTimes(1);
      callback.mockClear();
      emitter.emit();
      expect(callback).toBeCalledTimes(0);
    }
    {
      emitter.add(callback, { once: true });
      emitter.add(callback);
      expect(emitter.listenerCount).toBe(1);
      emitter.emit();
      expect(callback).toBeCalledTimes(1);
      callback.mockClear();
      emitter.emit();
      expect(callback).toBeCalledTimes(0);
    }
  }
});

describe('abort signal', () => {
  it.each([
    ['abort a listener', false],
    ['abort an once listener', true],
  ])(`%s`, (_, once) => {
    const emitter = new EventEmitter();
    const callback = vi.fn();
    const abortController = new AbortController();
    emitter.add(callback, { once, signal: abortController.signal });
    abortController.abort();
    expect(emitter.listenerCount).toBe(0);
    emitter.emit();
    expect(callback).toBeCalledTimes(0);
    abortController.abort();
  });
});

describe('errorBehavior', () => {
  let originalListeners: Array<(...args: unknown[]) => void>;

  beforeEach(() => {
    originalListeners = process.listeners('unhandledRejection') as Array<(...args: unknown[]) => void>;
    process.removeAllListeners('unhandledRejection');
    process.on('unhandledRejection', () => {});
  });

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.removeAllListeners('unhandledRejection');
    for (const listener of originalListeners) {
      process.on('unhandledRejection', listener as (...args: unknown[]) => void);
    }
  });

  it('should throw errors immediately by default', () => {
    const emitter = new EventEmitter();
    const error = new Error('test error');
    const callback = vi.fn(() => {
      throw error;
    });
    emitter.add(callback);

    expect(() => emitter.emit()).toThrow(error);
    expect(callback).toBeCalledTimes(1);
  });

  it('should not throw synchronously when errorBehavior is true', () => {
    const emitter = new EventEmitter({ errorBehavior: true });
    const error = new Error('deferred error');
    const callback = vi.fn(() => {
      throw error;
    });
    emitter.add(callback);

    expect(() => emitter.emit()).not.toThrow();
    expect(callback).toBeCalledTimes(1);
  });

  it('should still execute remaining listeners when errorBehavior is true', () => {
    const emitter = new EventEmitter({ errorBehavior: true });
    const error = new Error('deferred error');
    const callback1 = vi.fn(() => {
      throw error;
    });
    const callback2 = vi.fn();
    const callback3 = vi.fn(() => {
      throw error;
    });
    emitter.add(callback1);
    emitter.add(callback2);
    emitter.add(callback3);

    expect(() => emitter.emit()).not.toThrow();
    expect(callback1).toBeCalledTimes(1);
    expect(callback2).toBeCalledTimes(1);
    expect(callback3).toBeCalledTimes(1);
  });

  it('should throw immediately on the first error for multiple listeners by default', () => {
    const emitter = new EventEmitter();
    const error = new Error('sync error');
    const callback1 = vi.fn(() => {
      throw error;
    });
    const callback2 = vi.fn();
    emitter.add(callback1);
    emitter.add(callback2);

    expect(() => emitter.emit()).toThrow(error);
    expect(callback1).toBeCalledTimes(1);
    expect(callback2).toBeCalledTimes(0);
  });

  it('should emit args to listeners', () => {
    const emitter = new EventEmitter<[string, number]>();
    const callback = vi.fn();
    const error = new Error('test');
    emitter.add(callback);
    emitter.add(() => {
      throw error;
    });

    expect(() => emitter.emit('hello', 42)).toThrow(error);
    expect(callback).toBeCalledWith('hello', 42);
  });
});

describe('captureRejections', () => {
  it('should capture rejected promise from a single callback', async () => {
    const captureRejections = vi.fn();
    const emitter = new EventEmitter({ captureRejections });
    const error = new Error('promise rejected');
    const callback = vi.fn(() => Promise.reject(error));
    emitter.add(callback);

    emitter.emit('foo', 'bar');
    await vi.waitFor(() => {
      expect(captureRejections).toBeCalledTimes(1);
    });
    expect(captureRejections).toBeCalledWith(error, 'foo', 'bar');
  });

  it('should capture rejected promises from multiple callbacks', async () => {
    const captureRejections = vi.fn();
    const emitter = new EventEmitter({ captureRejections });
    const error1 = new Error('rejection 1');
    const error2 = new Error('rejection 2');
    const callback1 = vi.fn(() => Promise.reject(error1));
    const callback2 = vi.fn(() => Promise.reject(error2));
    emitter.add(callback1);
    emitter.add(callback2);

    emitter.emit();
    await vi.waitFor(() => {
      expect(captureRejections).toBeCalledTimes(2);
    });
    expect(captureRejections).toHaveBeenCalledWith(error1);
    expect(captureRejections).toHaveBeenCalledWith(error2);
  });

  it('should not call captureRejections for resolved promises', async () => {
    const captureRejections = vi.fn();
    const emitter = new EventEmitter({ captureRejections });
    const callback = vi.fn(() => Promise.resolve('ok'));
    emitter.add(callback);

    emitter.emit();
    await Promise.resolve();
    expect(captureRejections).toBeCalledTimes(0);
  });

  it('should not call captureRejections for non-promise returns', () => {
    const captureRejections = vi.fn();
    const emitter = new EventEmitter({ captureRejections });
    const callback = vi.fn(() => 42);
    emitter.add(callback);

    emitter.emit();
    expect(captureRejections).toBeCalledTimes(0);
  });

  it('should not fail when captureRejections is not set and promise rejects', async () => {
    const emitter = new EventEmitter();
    const error = new Error('unhandled');
    const callback = vi.fn(() => Promise.reject(error));
    emitter.add(callback);

    expect(() => emitter.emit()).not.toThrow();
  });

  it('should capture rejection with errorBehavior combined', async () => {
    const originalListeners = process.listeners('unhandledRejection');
    process.removeAllListeners('unhandledRejection');
    process.on('unhandledRejection', () => {});
    try {
      const captureRejections = vi.fn();
      const emitter = new EventEmitter({ errorBehavior: true, captureRejections });
      const error = new Error('deferred sync error');
      const rejection = new Error('promise rejection');
      const syncCb = vi.fn(() => {
        throw error;
      });
      const promiseCb = vi.fn(() => Promise.reject(rejection));
      emitter.add(syncCb);
      emitter.add(promiseCb);

      expect(() => emitter.emit()).not.toThrow();
      await vi.waitFor(() => {
        expect(captureRejections).toBeCalledTimes(1);
      });
      expect(captureRejections).toBeCalledWith(rejection);
    } finally {
      // Flush pending microtasks before restoring listeners
      await new Promise((resolve) => setTimeout(resolve, 0));
      process.removeAllListeners('unhandledRejection');
      for (const listener of originalListeners) {
        process.on('unhandledRejection', listener as (...args: unknown[]) => void);
      }
    }
  });
});
