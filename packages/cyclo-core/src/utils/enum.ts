import { ccenum, Enum } from 'cc';

export function markEnum<TEnum extends Record<string, unknown>>(e: TEnum) {
  ccenum(e);
}

export function DynamicEnum<TEnum extends Record<string, unknown>>(e: TEnum) {
  markEnum(e);
  return new Proxy(e, {
    set(target, p, newValue, receiver) {
      const returnValue = Reflect.set(target, p, newValue, receiver);
      Enum.update(target);
      return returnValue;
    },
  });
}
