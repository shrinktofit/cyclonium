import tinyInvariant from 'tiny-invariant';

export type InvariantMessage = string | (() => string);

export function invariant(
  condition: unknown,
  message?: InvariantMessage,
): asserts condition {
  tinyInvariant(condition, message);
}
