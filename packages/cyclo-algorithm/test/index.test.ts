import { describe, it, expect } from 'vitest';
import { partition } from '../src/partition.js';
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

describe('retainIf', () => {
  it('should retain matching items in place with stable order', () => {
    const array = [
      { id: 'a', keep: true },
      { id: 'b', keep: false },
      { id: 'c', keep: true },
      { id: 'd', keep: false },
      { id: 'e', keep: true },
    ];
    const original = array;
    retainIf(array, (item) => item.keep);
    expect(array).toBe(original);
    expect(array.map((item) => item.id)).toEqual(['a', 'c', 'e']);
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

  it('should leave an all-retained array unchanged', () => {
    const array = [1, 2, 3];
    const original = array;
    retainIf(array, (x: number) => x > 0);
    expect(array).toBe(original);
    expect(array).toEqual([1, 2, 3]);
  });

  it('should handle removing every item', () => {
    const array = [1, 2, 3];
    const original = array;
    retainIf(array, () => false);
    expect(array).toBe(original);
    expect(array).toEqual([]);
  });

  it('should handle empty arrays', () => {
    const array: number[] = [];
    retainIf(array, () => true);
    expect(array).toEqual([]);
  });
});

describe('removeIf', () => {
  it('should remove matching items in place with stable order', () => {
    const array = [
      { id: 'a', remove: false },
      { id: 'b', remove: true },
      { id: 'c', remove: false },
      { id: 'd', remove: true },
      { id: 'e', remove: false },
    ];
    const original = array;
    removeIf(array, (item) => item.remove);
    expect(array).toBe(original);
    expect(array.map((item) => item.id)).toEqual(['a', 'c', 'e']);
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
