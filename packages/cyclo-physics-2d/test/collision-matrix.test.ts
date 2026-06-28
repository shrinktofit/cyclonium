import { it, expect } from 'vitest';
import { CollisionMatrix } from '@/collision-matrix.js';

it('Collision matrix', () => {
  const collisionMatrix = new CollisionMatrix();
  collisionMatrix.set(0, 3, true);
  expect(stringifyTrueElements(collisionMatrix)).toEqual(['0,3']);
});

function stringifyTrueElements(collisionMatrix: CollisionMatrix) {
  const trueElements: string[] = [];
  for (let i = 0; i < CollisionMatrix.EXTENT; i++) {
    for (let j = 0; j <= i; j++) {
      const value = collisionMatrix.get(j, i);
      expect(value).toBe(collisionMatrix.get(i, j));
      if (value) {
        trueElements.push(`${j},${i}`);
      }
    }
  }
  return trueElements;
}
