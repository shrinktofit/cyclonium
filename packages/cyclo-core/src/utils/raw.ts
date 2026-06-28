import { cycloBuiltinClass } from '../export/internal.ts';

@cycloBuiltinClass('_Raw')
export class Raw<T> {
  constructor(public data: T) { }
}

export const dumpRaw: MethodDecorator = (target, propertyKey, descriptor: PropertyDescriptor) => {
  const get = descriptor.get;
  if (get) {
    descriptor.get = function () {
      return new Raw(get.call(this));
    };
  }
};
