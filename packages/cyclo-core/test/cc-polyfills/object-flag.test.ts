import { describe, expect, it } from 'vitest';
import { CCObject, isValid, Node } from 'cc';
import '@cyclonium/core/cc-polyfills/object-flag';

describe('public objectFlags extension', () => {
  it('should read engine flags and replace them through objectFlags', () => {
    /// @case
    /// Set engine hide flags, then replace them through the extension.
    /// @expect
    /// Both public properties observe the same engine state.
    const node = new Node('preview');
    node.hideFlags = CCObject.Flags.DontSave;
    expect(node.objectFlags & CCObject.Flags.DontSave).toBe(CCObject.Flags.DontSave);

    node.objectFlags = CCObject.Flags.HideInHierarchy;

    expect(node.hideFlags).toBe(CCObject.Flags.HideInHierarchy);
    expect(node.objectFlags).toBe(CCObject.Flags.HideInHierarchy);
  });

  it('should preserve lifecycle flags when adding editor flags', () => {
    /// @case
    /// Destroy a real object, then add editor flags through objectFlags.
    /// @expect
    /// The extension reads and preserves the engine ToDestroy flag.
    const object = new CCObject('pending-destruction');
    const initialFlags = object.objectFlags;
    object.destroy();
    const previousFlags = object.objectFlags;
    expect(previousFlags).not.toBe(initialFlags);

    const flags = CCObject.Flags.DontSave | CCObject.Flags.HideInHierarchy;
    object.objectFlags |= flags;

    expect(object.objectFlags).toBe(previousFlags | flags);
    expect(object.hideFlags & flags).toBe(flags);
    expect(isValid(object, true)).toBe(false);
  });

  it('should write lifecycle flags without restricting them to hide flags', () => {
    /// @case
    /// Write a lifecycle flag that the native hideFlags setter would discard.
    /// @expect
    /// Engine validity observes the full objectFlags value.
    const object = new CCObject('invalid');
    expect(object.isValid).toBe(true);

    object.objectFlags = CCObject.Flags.Destroyed;

    expect(object.objectFlags).toBe(CCObject.Flags.Destroyed);
    expect(object.isValid).toBe(false);
  });

  it('should keep flags independent between instances', () => {
    /// @case
    /// Give two nodes different flags and clear the first node's flags.
    /// @expect
    /// Each instance retains its own engine state.
    const first = new Node('first');
    const second = new Node('second');
    first.objectFlags = CCObject.Flags.DontSave;
    second.objectFlags = CCObject.Flags.HideInHierarchy;

    first.objectFlags = 0;

    expect(first.hideFlags).toBe(0);
    expect(second.objectFlags).toBe(CCObject.Flags.HideInHierarchy);
    expect(second.hideFlags).toBe(CCObject.Flags.HideInHierarchy);
  });

  it('should expose a configurable non-enumerable property', () => {
    /// @case
    /// Assign objectFlags and enumerate a real node's properties.
    /// @expect
    /// The extension remains non-enumerable and compatible with an existing polyfill.
    const node = new Node('preview');
    node.objectFlags = CCObject.Flags.DontSave;
    const properties: string[] = [];
    for (const property in node) {
      properties.push(property);
    }

    expect(properties).not.toContain('objectFlags');
    expect(Object.getOwnPropertyDescriptor(CCObject.prototype, 'objectFlags')).toMatchObject({
      enumerable: false,
      configurable: true,
    });
  });
});
