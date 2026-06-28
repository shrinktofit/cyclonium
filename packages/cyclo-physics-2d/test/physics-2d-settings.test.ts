import { describe, expect, it } from 'vitest';
import { Physics2DSettings } from '@/physics-2d-settings.js';
import { CollisionMatrix } from '@/collision-matrix.js';

describe('Physics2DSettings', () => {
  it('should have default fps', () => {
    const settings = new Physics2DSettings();
    expect(settings.fps).toBe(60);
  });

  it('should set fps', () => {
    const settings = new Physics2DSettings();
    settings.fps = 120;
    expect(settings.fps).toBe(120);
  });

  it('should have empty tags by default', () => {
    const settings = new Physics2DSettings();
    expect(settings.tags).toEqual({});
  });

  it('should return collisionMatrix', () => {
    const settings = new Physics2DSettings();
    expect(settings.collisionMatrix).toBeInstanceOf(CollisionMatrix);
  });

  it('should find tag index', () => {
    const settings = new Physics2DSettings();
    const settingsWithTags = settings as unknown as { _tags: Record<string, number> };
    settingsWithTags._tags = { player: 0, enemy: 1 };
    expect(settings.findTagIndex('player')).toBe(0);
    expect(settings.findTagIndex('enemy')).toBe(1);
    expect(settings.findTagIndex('unknown')).toBe(-1);
  });
});
