import { describe, it, expect } from 'vitest';
import { partition } from '../src/partition.js';
import { prune } from '../src/prune.js';
import { removeIf } from '../src/remove-if.js';
import { retainIf } from '../src/retain-if.js';

describe('partition', () => {
  it('should return a number', () => {
    const array = [1, 2, 3];
    const result = partition(array, (x: number) => x > 0);
    expect(typeof result).toBe('number');
  });

  it('should handle empty array', () => {
    const array: number[] = [];
    const result = partition(array, (x: number) => x > 0);
    expect(result).toBe(0);
  });
});

describe('prune', () => {
  it('should retain matching items as a deprecated alias', () => {
    const array = [1, 2, 3];
    prune(array, (x: number) => x > 2);
    expect(array).toEqual([3]);
  });
});

describe('retainIf', () => {
  it('should retain matching items in place', () => {
    const array = [1, 2, 3, 4, 5];
    const original = array;
    retainIf(array, (x: number) => x % 2 === 1);
    expect(array).toBe(original);
    expect(array).toEqual([1, 3, 5]);
  });

  it('should pass item index and array to predicate', () => {
    const array = ['a', 'b', 'c'];
    const indexes: number[] = [];
    const sameArray: boolean[] = [];
    retainIf(array, (item: string, index: number, items: string[]) => {
      indexes.push(index);
      sameArray.push(items === array);
      return item !== 'b';
    });
    expect(indexes).toEqual([0, 1, 2]);
    expect(sameArray).toEqual([true, true, true]);
    expect(array).toEqual(['a', 'c']);
  });
});

describe('removeIf', () => {
  it('should remove matching items in place', () => {
    const array = [1, 2, 3, 4, 5];
    const original = array;
    removeIf(array, (x: number) => x % 2 === 0);
    expect(array).toBe(original);
    expect(array).toEqual([1, 3, 5]);
  });

  it('should remove items by index predicate', () => {
    const array = ['a', 'b', 'c', 'd'];
    removeIf(array, (_item: string, index: number) => index < 2);
    expect(array).toEqual(['c', 'd']);
  });
});

describe('remove', () => {
  it('should exist', async () => {
    const { remove } = await import('../src/array/remove.js');
    expect(typeof remove).toBe('function');
  });
});
