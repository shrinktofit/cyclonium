import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyedEventEmitter } from '../src/index.js';
import { AbortController } from '@cyclonium/abort-controller';
import process from 'node:process';

describe('add and remove', () => {
  it('single', () => {
    const emitter = new KeyedEventEmitter<{ event: [] }>();
    const callback = vi.fn();
    emitter.add('event', callback);

    for (let i = 0; i < 2; ++i) {
      expect(emitter.listenersCountOn('event')).toBe(1);
      emitter.emit('event');
      expect(callback).toBeCalledTimes(1);
      callback.mockClear();
    }

    emitter.remove('event', callback);
    expect(emitter.listenersCountOn('event')).toBe(0);
    emitter.emit('event');
    expect(callback).toBeCalledTimes(0);
  });

  it('multiple', () => {
    const emitter = new KeyedEventEmitter<{ event: [] }>();
    const callbacks = Array.from({ length: 3 }, () => vi.fn());
    callbacks.forEach((callback, i) => {
      emitter.add('event', callback);
      expect(emitter.listenersCountOn('event')).toBe(i + 1);
    });
    for (let i = 0; i < 2; ++i) {
      emitter.emit('event');
      callbacks.forEach((callback) => {
        expect(callback).toBeCalledTimes(1);
      });
      callbacks.forEach((callback) => callback.mockClear());
    }
    const [first, middle, last] = callbacks;
    emitter.remove('event', middle);
    expect(emitter.listenersCountOn('event')).toBe(2);
    emitter.emit('event');
    expect(middle).toBeCalledTimes(0);
    [first, last].forEach((callback) => expect(callback).toBeCalledTimes(1));
    [first, last].forEach((callback) => callback.mockClear());
    emitter.remove('event', last);
    expect(emitter.listenersCountOn('event')).toBe(1);
    emitter.emit('event');
    expect(last).toBeCalledTimes(0);
    expect(first).toBeCalledTimes(1);
    first.mockClear();
    emitter.remove('event', first);
    expect(emitter.listenersCountOn('event')).toBe(0);
    emitter.emit('event');
    expect(first).toBeCalledTimes(0);
  });

  it('multiple keys', () => {
    const emitter = new KeyedEventEmitter<{ a: []; b: [] }>();
    const callbackA = vi.fn();
    const callbackB = vi.fn();
    emitter.add('a', callbackA);
    emitter.add('b', callbackB);

    emitter.emit('a');
    expect(callbackA).toBeCalledTimes(1);
    expect(callbackB).toBeCalledTimes(0);

    emitter.emit('b');
    expect(callbackA).toBeCalledTimes(1);
    expect(callbackB).toBeCalledTimes(1);
  });
});

describe('once', () => {
  it('emit once', () => {
    const emitter = new KeyedEventEmitter<{ event: [] }>();
    {
      const callback = vi.fn();
      emitter.add('event', callback, { once: true });
      expect(emitter.listenersCountOn('event')).toBe(1);
      emitter.emit('event');
      expect(callback).toBeCalledTimes(1);
      callback.mockClear();
      emitter.emit('event');
      expect(callback).toBeCalledTimes(0);
    }

    {
      const persistentCallbackPre = vi.fn();
      const onceCallback = vi.fn();
      const persistentCallbackPost = vi.fn();
      emitter.add('event', persistentCallbackPre);
      emitter.add('event', onceCallback, { once: true });
      emitter.add('event', persistentCallbackPost);
      expect(emitter.listenersCountOn('event')).toBe(3);
      emitter.emit('event');
      expect(persistentCallbackPre).toBeCalledTimes(1);
      expect(onceCallback).toBeCalledTimes(1);
      expect(persistentCallbackPost).toBeCalledTimes(1);
      persistentCallbackPre.mockClear();
      onceCallback.mockClear();
      persistentCallbackPost.mockClear();
      emitter.emit('event');
      expect(persistentCallbackPre).toBeCalledTimes(1);
      expect(onceCallback).toBeCalledTimes(0);
      expect(persistentCallbackPost).toBeCalledTimes(1);
    }
  });

  it('could be removed', () => {
    const emitter = new KeyedEventEmitter<{ event: [] }>();
    const callback = vi.fn();
    emitter.add('event', callback);
    expect(emitter.listenersCountOn('event')).toBe(1);
    emitter.remove('event', callback);
    expect(emitter.listenersCountOn('event')).toBe(0);
    emitter.emit('event');
    expect(callback).toBeCalledTimes(0);
  });
});

it('remove all', () => {
  const emitter = new KeyedEventEmitter<{ event: [] }>();
  const callbacks = Array.from({ length: 3 }, () => vi.fn());
  callbacks.forEach((callback, index) => emitter.add('event', callback, {
    once: index % 2 === 1,
  }));
  expect(emitter.listenersCountOn('event')).toBe(3);
  emitter.removeAll('event');
  expect(emitter.listenersCountOn('event')).toBe(0);
  emitter.emit('event');
  callbacks.forEach((callback) => expect(callback).toBeCalledTimes(0));
});

it('repeatedly add', () => {
  const emitter = new KeyedEventEmitter<{ event: [] }>();
  const callback = vi.fn();
  {
    emitter.add('event', callback);
    {
      emitter.add('event', callback);
      expect(emitter.listenersCountOn('event')).toBe(1);
      emitter.emit('event');
      expect(callback).toBeCalledTimes(1);
      callback.mockClear();
    }
    {
      emitter.add('event', callback, { once: true });
      expect(emitter.listenersCountOn('event')).toBe(1);
      for (let i = 0; i < 2; ++i) {
        emitter.emit('event');
        expect(callback).toBeCalledTimes(1);
        callback.mockClear();
      }
    }
  }
  emitter.removeAll('event');
  {
    {
      emitter.add('event', callback, { once: true });
      emitter.add('event', callback, { once: true });
      expect(emitter.listenersCountOn('event')).toBe(1);
      emitter.emit('event');
      expect(callback).toBeCalledTimes(1);
      callback.mockClear();
      emitter.emit('event');
      expect(callback).toBeCalledTimes(0);
    }
    {
      emitter.add('event', callback, { once: true });
      emitter.add('event', callback);
      expect(emitter.listenersCountOn('event')).toBe(1);
      emitter.emit('event');
      expect(callback).toBeCalledTimes(1);
      callback.mockClear();
      emitter.emit('event');
      expect(callback).toBeCalledTimes(0);
    }
  }
});

describe('abort signal', () => {
  it.each([
    ['abort a listener', false],
    ['abort an once listener', true],
  ])(`%s`, (_, once) => {
    const emitter = new KeyedEventEmitter<{ event: [] }>();
    const callback = vi.fn();
    const abortController = new AbortController();
    emitter.add('event', callback, { once, signal: abortController.signal });
    abortController.abort();
    expect(emitter.listenersCountOn('event')).toBe(0);
    emitter.emit('event');
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
    const emitter = new KeyedEventEmitter<{ event: [] }>();
    const error = new Error('test error');
    const callback = vi.fn(() => {
      throw error;
    });
    emitter.add('event', callback);

    expect(() => emitter.emit('event')).toThrow(error);
    expect(callback).toBeCalledTimes(1);
  });

  it('should not throw synchronously when errorBehavior is true', () => {
    const emitter = new KeyedEventEmitter<{ event: [] }>({ errorBehavior: true });
    const error = new Error('deferred error');
    const callback = vi.fn(() => {
      throw error;
    });
    emitter.add('event', callback);

    expect(() => emitter.emit('event')).not.toThrow();
    expect(callback).toBeCalledTimes(1);
  });

  it('should still execute remaining listeners when errorBehavior is true', () => {
    const emitter = new KeyedEventEmitter<{ event: [] }>({ errorBehavior: true });
    const error = new Error('deferred error');
    const callback1 = vi.fn(() => {
      throw error;
    });
    const callback2 = vi.fn();
    const callback3 = vi.fn(() => {
      throw error;
    });
    emitter.add('event', callback1);
    emitter.add('event', callback2);
    emitter.add('event', callback3);

    expect(() => emitter.emit('event')).not.toThrow();
    expect(callback1).toBeCalledTimes(1);
    expect(callback2).toBeCalledTimes(1);
    expect(callback3).toBeCalledTimes(1);
  });

  it('should throw immediately on the first error for multiple listeners by default', () => {
    const emitter = new KeyedEventEmitter<{ event: [] }>();
    const error = new Error('sync error');
    const callback1 = vi.fn(() => {
      throw error;
    });
    const callback2 = vi.fn();
    emitter.add('event', callback1);
    emitter.add('event', callback2);

    expect(() => emitter.emit('event')).toThrow(error);
    expect(callback1).toBeCalledTimes(1);
    expect(callback2).toBeCalledTimes(0);
  });

  it('should emit args to listeners', () => {
    const emitter = new KeyedEventEmitter<{ event: [string, number] }>();
    const callback = vi.fn();
    const error = new Error('test');
    emitter.add('event', callback);
    emitter.add('event', () => {
      throw error;
    });

    expect(() => emitter.emit('event', 'hello', 42)).toThrow(error);
    expect(callback).toBeCalledWith('hello', 42);
  });
});

describe('captureRejections', () => {
  it('should capture rejected promise from a single callback', async () => {
    const captureRejections = vi.fn();
    const emitter = new KeyedEventEmitter<{ event: [string, string] }>({ captureRejections });
    const error = new Error('promise rejected');
    const callback = vi.fn(() => Promise.reject(error));
    emitter.add('event', callback);

    emitter.emit('event', 'foo', 'bar');
    await vi.waitFor(() => {
      expect(captureRejections).toBeCalledTimes(1);
    });
    expect(captureRejections).toBeCalledWith(error, 'event', 'foo', 'bar');
  });

  it('should capture rejected promises from multiple callbacks', async () => {
    const captureRejections = vi.fn();
    const emitter = new KeyedEventEmitter<{ event: [] }>({ captureRejections });
    const error1 = new Error('rejection 1');
    const error2 = new Error('rejection 2');
    const callback1 = vi.fn(() => Promise.reject(error1));
    const callback2 = vi.fn(() => Promise.reject(error2));
    emitter.add('event', callback1);
    emitter.add('event', callback2);

    emitter.emit('event');
    await vi.waitFor(() => {
      expect(captureRejections).toBeCalledTimes(2);
    });
    expect(captureRejections).toHaveBeenCalledWith(error1, 'event');
    expect(captureRejections).toHaveBeenCalledWith(error2, 'event');
  });

  it('should capture rejection with correct key', async () => {
    const captureRejections = vi.fn();
    const emitter = new KeyedEventEmitter<{ a: []; b: [string] }>({ captureRejections });
    const errorA = new Error('rejection a');
    const errorB = new Error('rejection b');
    const callbackA = vi.fn(() => Promise.reject(errorA));
    const callbackB = vi.fn(() => Promise.reject(errorB));
    emitter.add('a', callbackA);
    emitter.add('b', callbackB);

    emitter.emit('a');
    emitter.emit('b', 'hello');
    await vi.waitFor(() => {
      expect(captureRejections).toBeCalledTimes(2);
    });
    expect(captureRejections).toHaveBeenCalledWith(errorA, 'a');
    expect(captureRejections).toHaveBeenCalledWith(errorB, 'b', 'hello');
  });

  it('should not call captureRejections for resolved promises', async () => {
    const captureRejections = vi.fn();
    const emitter = new KeyedEventEmitter<{ event: [] }>({ captureRejections });
    const callback = vi.fn(() => Promise.resolve('ok'));
    emitter.add('event', callback);

    emitter.emit('event');
    await Promise.resolve();
    expect(captureRejections).toBeCalledTimes(0);
  });

  it('should not call captureRejections for non-promise returns', () => {
    const captureRejections = vi.fn();
    const emitter = new KeyedEventEmitter<{ event: [] }>({ captureRejections });
    const callback = vi.fn(() => 42);
    emitter.add('event', callback);

    emitter.emit('event');
    expect(captureRejections).toBeCalledTimes(0);
  });

  it('should not fail when captureRejections is not set and promise rejects', async () => {
    const emitter = new KeyedEventEmitter<{ event: [] }>();
    const error = new Error('unhandled');
    const callback = vi.fn(() => Promise.reject(error));
    emitter.add('event', callback);

    expect(() => emitter.emit('event')).not.toThrow();
  });

  it('should capture rejection with errorBehavior combined', async () => {
    const originalListeners = process.listeners('unhandledRejection');
    process.removeAllListeners('unhandledRejection');
    process.on('unhandledRejection', () => {});
    try {
      const captureRejections = vi.fn();
      const emitter = new KeyedEventEmitter<{ event: [] }>({ errorBehavior: true, captureRejections });
      const error = new Error('deferred sync error');
      const rejection = new Error('promise rejection');
      const syncCb = vi.fn(() => {
        throw error;
      });
      const promiseCb = vi.fn(() => Promise.reject(rejection));
      emitter.add('event', syncCb);
      emitter.add('event', promiseCb);

      expect(() => emitter.emit('event')).not.toThrow();
      await vi.waitFor(() => {
        expect(captureRejections).toBeCalledTimes(1);
      });
      expect(captureRejections).toBeCalledWith(rejection, 'event');
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 0));
      process.removeAllListeners('unhandledRejection');
      for (const listener of originalListeners) {
        process.on('unhandledRejection', listener as (...args: unknown[]) => void);
      }
    }
  });
});
