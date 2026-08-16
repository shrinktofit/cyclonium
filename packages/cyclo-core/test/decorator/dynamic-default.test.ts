import { CCClass } from 'cc';
import { describe, expect, it } from 'vitest';
import {
  dynamicDefault,
  editable,
  cycloClass,
  stored,
} from '@/export/legacy-decorator.js';

describe('dynamicDefault', () => {
  it('should clear the captured default for stored properties', () => {
    /// @case
    /// A stored property has a per-instance dynamic initializer and is finalized by `cycloClass`.
    /// @expect
    /// Its captured reusable default is cleared while the property remains registered with CCClass.
    @cycloClass(nextClassName('SerializableDynamicDefault'))
    class Target {
      @stored
      @dynamicDefault
      value = Math.random();
    }

    expect(hasDefaultAttr(Target, 'value')).toBe(true);
    expect(getDefaultAttr(Target, 'value')).toBeUndefined();
  });

  it('should clear the captured default for editable properties', () => {
    /// @case
    /// An editable property has a per-instance dynamic initializer and is finalized by `cycloClass`.
    /// @expect
    /// Its captured reusable default is cleared while the property remains registered with CCClass.
    @cycloClass(nextClassName('EditableDynamicDefault'))
    class Target {
      @editable
      @dynamicDefault
      value = Math.random();
    }

    expect(hasDefaultAttr(Target, 'value')).toBe(true);
    expect(getDefaultAttr(Target, 'value')).toBeUndefined();
  });

  it('should clear the captured default for properties only marked as dynamic default', () => {
    /// @case
    /// A property is marked only as dynamic-default before its class is finalized by `cycloClass`.
    /// @expect
    /// CCClass receives an explicit undefined default without storage or Inspector metadata being required.
    @cycloClass(nextClassName('OnlyDynamicDefault'))
    class Target {
      @dynamicDefault
      value = Math.random();
    }

    expect(hasDefaultAttr(Target, 'value')).toBe(true);
    expect(getDefaultAttr(Target, 'value')).toBeUndefined();
  });

  it('should not apply dynamic defaults when the class is not finalized by cycloClass', () => {
    /// @case
    /// A property is marked as dynamic-default but its class is never finalized by `cycloClass`.
    /// @expect
    /// The plain class is not registered and no CCClass default metadata is written.
    class Target {
      @dynamicDefault
      value = Math.random();
    }

    expect(CCClass._isCCClass(Target)).toBe(false);
    expect(hasDefaultAttr(Target, 'value')).toBe(false);
  });
});

let nextId = 0;

type TargetClass = abstract new (...args: never[]) => object;

function nextClassName(prefix: string): string {
  nextId++;
  return `CycloCoreTest${prefix}${nextId}`;
}

function getDefaultAttr(target: TargetClass, propertyName: string): unknown {
  return (CCClass.attr(target, propertyName) as { readonly default?: unknown }).default;
}

function hasDefaultAttr(target: TargetClass, propertyName: string): boolean {
  const attrs = CCClass.Attr.getClassAttrs(target) as Record<string, unknown>;
  return `${propertyName}${CCClass.Attr.DELIMETER}default` in attrs;
}
