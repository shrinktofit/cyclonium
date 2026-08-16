import { CCClass, CCInteger } from 'cc'
import { describe, expect, it } from 'vitest'
import * as legacyDecorators from '@/export/legacy-decorator.js'
import {
  cycloClass,
  editable,
  stored,
} from '@/export/legacy-decorator.js'

describe('property decorators', () => {
  it('keeps storage and Inspector editing as independent capabilities', () => {
    /// @case
    /// A CCClass declares stored-only, editable-only, and combined properties in both decorator orders through the public Cyclo decorators.
    /// @expect
    /// CCClass metadata enables only the requested storage and Inspector capabilities, independent of decorator execution order.
    @cycloClass(nextClassName('IndependentCapabilities'))
    class Target {
      @stored
      storedOnly = 1

      @editable
      editableOnly = 2

      @stored
      @editable
      storedAndEditable = 3

      @editable
      @stored
      editableAndStored = 4
    }

    expect(getPropertyAttrs(Target, 'storedOnly')).toMatchObject({
      serializable: true,
      visible: false,
    })
    expect(getPropertyAttrs(Target, 'editableOnly')).toMatchObject({
      serializable: false,
      visible: true,
    })
    expect(getPropertyAttrs(Target, 'storedAndEditable')).toMatchObject({
      serializable: true,
      visible: true,
    })
    expect(getPropertyAttrs(Target, 'editableAndStored')).toMatchObject({
      serializable: true,
      visible: true,
    })
  })

  it('preserves normalized Inspector options and underscore display names', () => {
    /// @case
    /// Editable properties use the supported Inspector options, radians normalization, and an underscore-prefixed backing name.
    /// @expect
    /// CCClass metadata retains every option, normalizes radians, and displays `_skinWidth` as `skinWidth` without persisting it.
    const visible = () => true

    @cycloClass(nextClassName('EditableOptionsBase'))
    class Base {
      @editable
      configured = 0
    }

    @cycloClass(nextClassName('EditableOptions'))
    class Target extends Base {
      @editable({
        type: CCInteger,
        min: 1,
        max: 9,
        step: 2,
        slide: true,
        radian: true,
        unit: 'rad',
        visible,
        group: 'motion',
        override: true,
        readonly: true,
        tooltip: 'Configured value',
      })
      override configured = 1

      @editable({ radians: true })
      angle = 0

      @editable
      _skinWidth = 0.01
    }

    expect(getPropertyAttrs(Target, 'configured')).toMatchObject({
      type: CCInteger,
      min: 1,
      max: 9,
      step: 2,
      slide: true,
      radian: true,
      unit: 'rad',
      visible,
      group: 'motion',
      readonly: true,
      tooltip: 'Configured value',
      serializable: false,
    })
    expect(getPropertyAttrs(Target, 'angle')).toMatchObject({
      min: 0,
      max: Math.PI * 2,
      step: 1,
      radian: true,
      visible: true,
      serializable: false,
    })
    expect(getPropertyAttrs(Target, '_skinWidth')).toMatchObject({
      displayName: 'skinWidth',
      visible: true,
      serializable: false,
    })
  })

  it('does not expose the removed serializable compatibility decorator', () => {
    /// @case
    /// A consumer inspects the public legacy-decorator entrypoint after the breaking migration.
    /// @expect
    /// The ambiguous Cyclo `serializable` wrapper is absent and `stored` is public.
    expect(legacyDecorators).not.toHaveProperty('serializable')
    expect(legacyDecorators).toHaveProperty('stored', stored)
  })
})

let nextId = 0

type TargetClass = abstract new (...args: never[]) => object

function nextClassName(prefix: string): string {
  nextId++
  return `CycloCoreTest${prefix}${nextId}`
}

function getPropertyAttrs(target: TargetClass, propertyName: string): Record<string, unknown> {
  return CCClass.attr(target, propertyName) as Record<string, unknown>
}
