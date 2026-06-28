export interface ShortenPropertyDecorator<TArgs extends any[]> {
  (...args: TArgs): PropertyDecorator;
  (target: Object, propertyKey: string | symbol): void;
}

export function defineShortenPropertyDecorator<TArgs extends any[]>(
  decorator: (...args: TArgs) => PropertyDecorator,
  ...defaultArgs: TArgs
): ShortenPropertyDecorator<TArgs> {
  return ((...args: unknown[]) => {
    if (args.length === 0) {
      // @x()
      return decorator(...defaultArgs);
    } else if (!(typeof args[0] === 'object' && args[0] && typeof args[1] === 'string' || typeof args[1] === 'symbol')) {
      // @x(opts)
      return decorator(...(args as TArgs));
    } else {
      // @x
      return decorator(...defaultArgs)(...(args as Parameters<PropertyDecorator>));
    }
  }) as ShortenPropertyDecorator<TArgs>;
}
