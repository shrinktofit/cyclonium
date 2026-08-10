import { describe, expect, it } from 'vitest';
import { TimeAccumulator } from '@/framework/time-accumulator.js';

describe('TimeAccumulator', () => {
  it('should accumulate partial time until a complete step is available', () => {
    /// @case
    /// 1. An accumulator uses a 1/60-second step duration.
    /// 2. It advances twice by 1/120 second.
    /// @expect
    /// The first advance yields no step and the second yields exactly one step without residual time.
    const accumulator = new TimeAccumulator(1 / 60);

    expect(accumulator.advance(1 / 120, 4)).toBe(0);
    expect(accumulator.advance(1 / 120, 4)).toBe(1);
    expect(accumulator.advance(0, 4)).toBe(0);
  });

  it('should clamp an overloaded advance without discarding prior fractional time', () => {
    /// @case
    /// 1. A 0.1-second accumulator retains 0.04 seconds from an earlier advance.
    /// 2. A later advance receives 0.37 seconds with a two-step budget.
    /// 3. Another 0.06 seconds is advanced after the overloaded input.
    /// @expect
    /// The overloaded advance accepts only 0.2 seconds, while the earlier 0.04-second remainder is retained and completes the next step.
    const accumulator = new TimeAccumulator(0.1);

    expect(accumulator.advance(0.04, 2)).toBe(0);
    expect(accumulator.advance(0.37, 2)).toBe(2);
    expect(accumulator.advance(0.06, 2)).toBe(1);
  });

  it('should reset accumulated time', () => {
    /// @case An accumulator retains both a complete backlog step and fractional elapsed time.
    /// @expect Reset removes all retained time and restores a full wait until the next step.
    const accumulator = new TimeAccumulator(0.1);
    accumulator.advance(0.25, 1);

    accumulator.reset();

    expect(accumulator.advance(0.05, 1)).toBe(0);
    expect(accumulator.advance(0.05, 1)).toBe(1);
  });
});
