/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { _decorator, CCClass, Component } from 'cc';
import { editable } from './editable/editable.ts';

export { editable };

const dynamicDefaultProperties = new WeakMap<object, Set<string>>();

export interface CycloClassOptions {
  name?: string;
  abstract?: boolean;
}

export interface CycloClassDecorator {
  (options?: CycloClassOptions): ClassDecorator;
  (name?: string): ClassDecorator;
  <TFunction extends Function>(target: TFunction): TFunction | void;
}

export function createScopedCycloClassDecorator(opts: {
  scope: string;
}): CycloClassDecorator {
  const { scope } = opts;

  function cycloClass(options?: CycloClassOptions): ClassDecorator;

  function cycloClass(name?: string): ClassDecorator;

  function cycloClass<TFunction extends Function>(target: TFunction): TFunction | void;

  function cycloClass(...args: unknown[]): unknown {
    if (args.length === 0) {
      return cycloClassWithOptions(scope);
    } else if (typeof args[0] === 'string') {
      return cycloClassWithOptions(scope, { name: args[0] });
    } else if (typeof args[0] === 'object' && args[0]) {
      return cycloClassWithOptions(scope, args[0]);
    } else {
      return cycloClassWithOptions(scope)(...(args as [Function]));
    }
  }

  return cycloClass;
}

function cycloClassWithOptions(scope: string, options?: CycloClassOptions): ClassDecorator {
  return <TFunction extends Function>(target: TFunction) => {
    const name = options?.name ?? target.name;
    if (!(options?.abstract) && target.prototype instanceof Component) {
      _decorator.menu(`${scope}/${name}`)(target);
    }
    _decorator.ccclass(typeof name === 'string' ? `${scope}${name}` : name)(target);
    const propertyNames = dynamicDefaultProperties.get(target.prototype);
    if (propertyNames) {
      for (const propertyName of propertyNames) {
        CCClass.Attr.setClassAttr(target, propertyName, 'default', undefined);
      }
      dynamicDefaultProperties.delete(target.prototype);
    }
  };
}

const cycloClass = createScopedCycloClassDecorator({
  scope: '',
});

const cycloBuiltinClass = createScopedCycloClassDecorator({
  scope: 'cyclo.',
});

export { cycloClass, cycloBuiltinClass };

export const serializable = _decorator.property;

/**
 * Marks that the property's default value might vary between instances.
 * @description
 * Use this for dynamic initializers such as `_time = Math.random()`.
 * Cocos will avoid treating that initializer result as a reusable default, for
 * example when stripping default values during serialization.
 */
export const dynamicDefault: PropertyDecorator = (target: object, propertyKey: string | symbol) => {
  if (typeof propertyKey !== 'string') {
    return;
  }

  let propertyNames = dynamicDefaultProperties.get(target);
  if (!propertyNames) {
    propertyNames = new Set<string>();
    dynamicDefaultProperties.set(target, propertyNames);
  }
  propertyNames.add(propertyKey);
};

export const designType = _decorator.type;

export const editorOnly = (...args: Parameters<PropertyDecorator>) => {
  _decorator.property({ serializable: true, editorOnly: true })(...args);
};

export const idem: MethodDecorator = <T>(_: object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>) => {
  const set = descriptor.set;
  descriptor.set = function (value) {
    // @ts-expect-error Dynamic property access by the decorated key.
    if (this[propertyKey] === value) {
      return;
    }
    // @ts-expect-error Setter type is preserved by the original descriptor.
    set.call(this, value);
  };
};

export function idemBy<T>(equals: (a: T, b: T) => boolean): MethodDecorator {
  return <U>(_target: object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<U>) => {
    const set = descriptor.set;
    descriptor.set = function (value) {
      // @ts-expect-error Dynamic property access by the decorated key.
      if (equals(this[propertyKey], value)) {
        return;
      }
      // @ts-expect-error Setter type is preserved by the original descriptor.
      set.call(this, value);
    };
  };
}
