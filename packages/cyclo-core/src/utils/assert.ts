export function assert(value: unknown, message?: string): asserts value {
  if (!value) {
    debugger;
    throw new Error(`Assertion failed: ${message ?? '<no-message>'}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace assert {
  export function unreachable(): never {
    assert(false, 'Unreachable');
  }
}
