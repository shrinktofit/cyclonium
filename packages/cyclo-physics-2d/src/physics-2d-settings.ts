import { Asset } from 'cc';
import { editable, serializable } from '@cyclonium/core/legacy-decorator';
import { cycloBuiltinClass } from '@cyclonium/core/internal';
import { CollisionMatrix } from './collision-matrix.js';
import { dumpRaw } from '@cyclonium/core/utils';

@cycloBuiltinClass('Physics2DSettings')
export class Physics2DSettings extends Asset {
  @serializable
  @editable
  fps = 60;

  get tags() {
    return this._tags;
  }

  @editable
  @dumpRaw
  private get tags_editor() {
    return this._tags;
  }

  private set tags_editor(value) {
    this._tags = { ...value };
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
}
