import { CCClass } from 'cc';
import { describe, expect, it } from 'vitest';
import {
  dynamicDefault,
  editable,
  cycloClass,
  serializable,
} from '@/export/legacy-decorator.js';

describe('dynamicDefault', () => {
  it('should clear the captured default for serializable properties', () => {
    @cycloClass(nextClassName('SerializableDynamicDefault'))
    class Target {
      @serializable
      @dynamicDefault
      value = Math.random();
    }

    expect(hasDefaultAttr(Target, 'value')).toBe(true);
    expect(getDefaultAttr(Target, 'value')).toBeUndefined();
  });

  it('should clear the captured default for editable properties', () => {
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
    @cycloClass(nextClassName('OnlyDynamicDefault'))
    class Target {
      @dynamicDefault
      value = Math.random();
    }

    expect(hasDefaultAttr(Target, 'value')).toBe(true);
    expect(getDefaultAttr(Target, 'value')).toBeUndefined();
  });

  it('should not apply dynamic defaults when the class is not finalized by cycloClass', () => {
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
