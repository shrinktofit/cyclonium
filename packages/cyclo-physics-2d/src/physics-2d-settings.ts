import { Asset, CCInteger } from 'cc';
import { editable, serializable } from '@cyclonium/core/legacy-decorator';
import { cycloBuiltinClass } from '@cyclonium/core/internal';
import { CollisionMatrix } from './collision-matrix.js';
import { dumpRaw } from '@cyclonium/core/utils';

@cycloBuiltinClass('Physics2DSettings')
export class Physics2DSettings extends Asset {
  @serializable
  @editable({ min: 1 })
  fps = 60;

  @serializable
  @editable({ type: CCInteger, min: 1, step: 1 })
  maxSubsteps = 4;

  get tags() {
    return this._tags;
  }

  @editable
  get collisionMatrix() {
    return this._collisionMatrix;
  }

  findTagIndex(tag: string) {
    return this._tags[tag] ?? -1;
  }

  @serializable
  private _tags: Record<string, number> = {};

  @serializable
  private _collisionMatrix = new CollisionMatrix();

  @editable
  @dumpRaw
  // eslint-disable-next-line @typescript-eslint/naming-convention -- Cocos editor inspectors consume this serialized compatibility property by name.
  private get tags_editor() {
    return this._tags;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention -- Cocos editor inspectors consume this serialized compatibility property by name.
  private set tags_editor(value) {
    this._tags = { ...value };
  }
}
