import { describe, it, expect } from 'vitest';
import { remove } from '../src/array/remove.js';

describe('array/remove', () => {
  describe('basic remove', () => {
    it('should remove existing item', () => {
      const array = [1, 2, 3];
      const result = remove(array, 2);
      expect(result).toBe(true);
      expect(array).toEqual([1, 3]);
    });

    it('should remove first item', () => {
      const array = [1, 2, 3];
      const result = remove(array, 1);
      expect(result).toBe(true);
      expect(array).toEqual([2, 3]);
    });

    it('should remove last item', () => {
      const array = [1, 2, 3];
      const result = remove(array, 3);
      expect(result).toBe(true);
      expect(array).toEqual([1, 2]);
    });

    it('should return false for non-existing item', () => {
      const array = [1, 2, 3];
      const result = remove(array, 4);
      expect(result).toBe(false);
      expect(array).toEqual([1, 2, 3]);
    });

    it('should handle empty array', () => {
      const array: number[] = [];
      const result = remove(array, 1);
      expect(result).toBe(false);
      expect(array).toEqual([]);
    });

    it('should handle single item array removed', () => {
      const array = [1];
      const result = remove(array, 1);
      expect(result).toBe(true);
      expect(array).toEqual([]);
    });
  });

  describe('with objects', () => {
    it('should remove object by reference', () => {
      const obj1 = { a: 1 };
      const obj2 = { b: 2 };
      const obj3 = { c: 3 };
      const array = [obj1, obj2, obj3];
      const result = remove(array, obj2);
      expect(result).toBe(true);
      expect(array).toEqual([obj1, obj3]);
    });
  });

  describe('with strings', () => {
    it('should remove string item', () => {
      const array = ['a', 'b', 'c'];
      const result = remove(array, 'b');
      expect(result).toBe(true);
      expect(array).toEqual(['a', 'c']);
    });
  });

  describe('multiple remove calls', () => {
    it('should handle sequential removes', () => {
      const array = [1, 2, 3, 4, 5];
      remove(array, 2);
      remove(array, 4);
      expect(array).toEqual([1, 3, 5]);
    });

    it('should handle trying to remove same item twice', () => {
      const array = [1, 2, 3];
      remove(array, 2);
      const result = remove(array, 2);
      expect(result).toBe(false);
      expect(array).toEqual([1, 3]);
    });
  });
});
