/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { _decorator, Component, type Constructor } from 'cc';
import { CycloComponent } from '../../framework/component.ts';
import { getExecutionOrder, setExecutionOrder } from '../../framework/execution-order.ts';

export function executionOrder(order: number) {
  return defineComponentDecorator((target) => {
    setExecutionOrder(target, order);
  });
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace executionOrder {
  export function lateThan(component: CycloComponentClass) {
    return defineComponentDecorator((target) => {
      setExecutionOrder(target, getExecutionOrder(component) + 1);
    });
  }
}

export const disallowMultiple = defineComponentDecoratorWithOptionalBoolean((target, value) => {
  _decorator.disallowMultiple(value)(target);
});

export const executeInEditMode = defineComponentDecoratorWithOptionalBoolean((target, value) => {
  _decorator.executeInEditMode(value)(target);
});

function addRequiredComponent(target: new (...args: never[]) => CycloComponent, componentType: Constructor<Component>) {
  let _requireComponent = Reflect.getOwnPropertyDescriptor(target.constructor, '_requireComponent')?.value;
  if (_requireComponent === undefined) {
    _requireComponent = [];
    Reflect.defineProperty(target.constructor, '_requireComponent', {
      value: _requireComponent,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  _requireComponent.push(componentType);
}

export function requiresComponent<T extends Component>(componentType: Constructor<T>) {
  return defineComponentMethodDecorator((target, propertyKey, descriptor) => {
    addRequiredComponent(target, componentType);

    if (descriptor.set !== undefined) {
      throw new Error(`Property ${String(propertyKey)} of should not has set`);
    }
    if (descriptor.value !== undefined) {
      throw new Error(`Property ${String(propertyKey)} of should not has value`);
    }
    return {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get(this: CycloComponent) {
        const component = this.getComponent(componentType);
        if (!component) {
          throw new Error(`Component ${componentType.name} is not found.`);
        }
        return component;
      },
    };
  });
}

type CycloComponentClass = new (...args: never[]) => CycloComponent;

function defineComponentDecorator(decorate: (target: CycloComponentClass) => void): ClassDecorator {
  return <TFunction extends Function>(target: TFunction): TFunction | void => {
    if (!(target.prototype instanceof CycloComponent)) {
      throw new Error(`Class ${target.name} is not a subclass of CycloComponent.`);
    }
    decorate(target as unknown as CycloComponentClass);
  };
}

function defineComponentDecoratorWithOptionalBoolean(decorate: (target: CycloComponentClass, value?: boolean) => void) {
  return ((...args: unknown[]) => {
    const arg0 = args[0];
    if (typeof arg0 === 'boolean' || arg0 === undefined) {
      return defineComponentDecorator((target) => {
        decorate(target, arg0);
      });
    } else {
      return defineComponentDecorator((target) => {
        decorate(target);
      })(...args as [Function]);
    }
  }) as (((value?: boolean) => ClassDecorator) & ClassDecorator);
}

function defineComponentMethodDecorator(decorate: (target: CycloComponentClass, propertyKey: string | symbol, descriptor: PropertyDescriptor) => PropertyDescriptor | undefined): MethodDecorator {
  return (target: unknown, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    if (!(target instanceof CycloComponent)) {
      throw new Error(`Class ${String(target)} is not a subclass of CycloComponent.`);
    }
    return decorate(target as unknown as CycloComponentClass, propertyKey, descriptor);
  };
};
