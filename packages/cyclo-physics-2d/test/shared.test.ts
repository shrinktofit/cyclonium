import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createCollisionEventEmitter, ContactEventListenerFlagIndex } from '@/shared.js';
import { ManagedEventEmitter } from '@cyclonium/event';

describe('shared', () => {
  describe('ContactEventListenerFlagIndex', () => {
    it('should have correct values', () => {
      expect(ContactEventListenerFlagIndex.begin).toBe(0);
      expect(ContactEventListenerFlagIndex.stay).toBe(1);
      expect(ContactEventListenerFlagIndex.end).toBe(2);
      expect(ContactEventListenerFlagIndex.body).toBe(8);
    });
  });

  describe('createCollisionEventEmitter', () => {
    let callback: Mock;
    let emitter: ManagedEventEmitter<[number, string]>;

    beforeEach(() => {
      callback = vi.fn();
      emitter = createCollisionEventEmitter<[number, string]>(callback);
    });

    it('should create a ManagedEventEmitter', () => {
      expect(emitter).toBeInstanceOf(ManagedEventEmitter);
    });

    it('should emit events to all listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      emitter.add(listener1);
      emitter.add(listener2);

      emitter.emit(1, 'test');

      expect(listener1).toHaveBeenCalledWith(1, 'test');
      expect(listener2).toHaveBeenCalledWith(1, 'test');
    });

    it('should allow removing specific listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      emitter.add(listener1);
      emitter.add(listener2);

      emitter.remove(listener1);
      emitter.emit(1, 'test');

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith(1, 'test');
    });

    it('should report correct listener count', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      expect(emitter.listenerCount).toBe(0);

      emitter.add(listener1);
      expect(emitter.listenerCount).toBe(1);

      emitter.add(listener2);
      expect(emitter.listenerCount).toBe(2);

      emitter.remove(listener1);
      expect(emitter.listenerCount).toBe(1);

      emitter.removeAll();
      expect(emitter.listenerCount).toBe(0);
    });

    it('should call callback when adding first listener', () => {
      callback.mockClear();
      const listener = vi.fn();
      emitter.add(listener);
      expect(callback).toHaveBeenCalledWith(true);
    });

    it('should call callback when removing last listener via removeAll', () => {
      const listener1 = vi.fn();
      emitter.add(listener1);
      callback.mockClear();

      emitter.removeAll();
      expect(callback).toHaveBeenCalledWith(false);
    });
  });
});
