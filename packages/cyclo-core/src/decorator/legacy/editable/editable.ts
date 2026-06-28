/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { CCInteger, type CCBoolean, type CCFloat, type CCString } from 'cc';
import { isSubClassOfInclusive } from '../../../utils/inheritance.ts';
import { logger } from '../../../utils/logger.ts';
import { createDecoratorForSetEditableMetadata } from './common.ts';

export interface EditableDecoratorOptions {
  type?: Function | typeof CCInteger;
  min?: number;
  max?: number;
  step?: number;
  slide?: boolean;
  /** @deprecated Use `radians` instead. */
  radian?: boolean;
  radians?: boolean;
  unit?: string;
  visible?: boolean | (() => boolean);
  group?: string;
  override?: boolean;
  readonly?: boolean;
  tooltip?: string;
}

function editable(options?: EditableDecoratorOptions): PropertyDecorator;

function editable(type?: Function): PropertyDecorator;

function editable(type?: typeof CCInteger | typeof CCBoolean | typeof CCFloat | typeof CCString): PropertyDecorator;

function editable(target: object, propertyKey: string | symbol): void;

function editable(...args: unknown[]): unknown {
  if (args.length === 0) {
    // `@editable()`
    return editableWithOptions({});
  } else if (args.length === 1) {
    const args0 = args[0];
    if (typeof args0 === 'object' && args0) {
      if (args0.constructor === CCInteger.constructor) {
        // `@editable(CCInteger)`
        return editableWithOptions({
          type: args0 as typeof CCInteger,
        });
      }
      // `@editable(options)`
      return editableWithOptions(args0);
    } else if (typeof args0 === 'function') {
      if (isSubClassOfInclusive(args0, Array)) {
        // https://forum.cocos.org/t/topic/165943
        logger.warn(`@editable(Array) is not supported.`);
      }
      // `@editable(Node)`
      return editableWithOptions({
        type: args0,
      });
    } else {
      throw new Error(`Invalid @editable() arguments.`);
    }
  } else {
    // `@editable`
    return editableWithOptions({})(...(args as [object, string | symbol]));
  }
}

function editableWithOptions(options: EditableDecoratorOptions): PropertyDecorator {
  return (...args: Parameters<PropertyDecorator>) => {
    const modifiedOptions = { ...options };
    if (modifiedOptions.radians !== undefined) {
      modifiedOptions.radian = modifiedOptions.radians;
    }
    if (modifiedOptions.radian) {
      if (modifiedOptions.min === undefined && modifiedOptions.max === undefined) {
        modifiedOptions.min = 0;
        modifiedOptions.max = Math.PI * 2;
      }
      if (modifiedOptions.step === undefined) {
        modifiedOptions.step = 1;
      }
    }
    createDecoratorForSetEditableMetadata(modifiedOptions)(...args);
  };
}

export { editable };
