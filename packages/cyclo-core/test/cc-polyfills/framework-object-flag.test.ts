import { describe, expect, it } from 'vitest';
import { CCObject, Node } from 'cc';
import '@cyclonium/core/framework';

describe('framework objectFlags polyfill', () => {
  it('should set engine hide flags after importing framework', () => {
    /// @case
    /// Import only the public framework entry and set editor flags on a real node.
    /// @expect
    /// The flags affect the engine rather than creating an unrelated property.
    const node = new Node('handles-render-root');
    const flags = CCObject.Flags.DontSave | CCObject.Flags.HideInHierarchy;

    node.objectFlags |= flags;

    expect(node.hideFlags & flags).toBe(flags);
  });
});
