import {
  cycloClass,
  editable,
  stored,
} from '@cyclonium/core/legacy-decorator/general';
import { CCClass, js } from 'cc';
import { describe, expect, it } from 'vitest';
import {
  AssetGroupAsset,
  AssetGroupEntry,
  AssetPipelineSettingsAsset,
} from '../exports/src/runtime/index.js';

describe('Cyclo OMS runtime export', () => {
  it('registers the UniversalAsset classes needed by Scene deserialization', () => {
    /// @case
    /// 1. A project loads the extension root through OMS.
    /// 2. Scene deserialization looks up the persisted authoring class names.
    /// @expect
    /// Both Cyclo UniversalAsset classes have been registered in the project runtime.
    expect(js.getClassByName('cyclo.AssetPipelineSettings')).toBeDefined();
    expect(js.getClassByName('cyclo.AssetGroup')).toBeDefined();
    expect(js.getClassByName('cyclo.AssetGroupAnchor')).toBeDefined();
  });

  it('keeps internal authoring data out of the generic Inspector', () => {
    /// @case
    /// 1. The extension registers its UniversalAsset authoring classes.
    /// 2. The generic Inspector reads the classes' public Cocos property metadata.
    /// @expect
    /// Storage-only fields stay hidden while intentional Group controls remain editable.
    expect(CCClass.attr(AssetGroupEntry, 'id').visible).toBe(false);
    expect(CCClass.attr(AssetGroupAsset, 'schemaVersion').visible).toBe(false);
    expect(CCClass.attr(AssetGroupAsset, 'id').visible).toBe(false);
    expect(CCClass.attr(AssetGroupAsset, 'entries').visible).toBe(false);
    expect(CCClass.attr(AssetPipelineSettingsAsset, 'groupOrder').visible).toBe(false);

    expect(CCClass.attr(AssetGroupAsset, 'groupName').visible).toBe(true);
    expect(CCClass.attr(AssetGroupAsset, 'includeInBuild').visible).toBe(true);
    expect(CCClass.attr(AssetGroupAsset, 'delivery')).toMatchObject({
      visible: true,
      readonly: true,
    });
  });

  it('keeps storage and Inspector editability as independent metadata', () => {
    /// @case
    /// 1. One field is Inspector-only and another composes storage with editability.
    /// 2. Cocos consumes the metadata through the public Cyclo decorators.
    /// @expect
    /// Editable-only data is transient while the composed field remains persisted.
    class Target {
      transientValue = 1;
      persistedValue = 2;
    }
    editable(Target.prototype, 'transientValue');
    stored(Target.prototype, 'persistedValue');
    editable(Target.prototype, 'persistedValue');
    cycloClass('CycloAssetPipelineTestDecoratorSemantics')(Target);

    expect(CCClass.attr(Target, 'transientValue')).toMatchObject({
      serializable: false,
      visible: true,
    });
    expect(CCClass.attr(Target, 'persistedValue')).toMatchObject({
      serializable: true,
      visible: true,
    });
  });
});
