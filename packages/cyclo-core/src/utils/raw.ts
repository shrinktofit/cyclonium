import { cycloBuiltinClass } from '../export/internal.ts';

@cycloBuiltinClass('_Raw')
export class Raw<T> {
  constructor(public data: T) { }
}

export const dumpRaw: MethodDecorator = (_target, _propertyKey, descriptor: PropertyDescriptor) => {
  // The getter is deliberately invoked later with the decorated instance as its receiver.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const get = descriptor.get;
  if (get) {
    descriptor.get = function () {
      return new Raw(get.call(this));
    };
  }
};
