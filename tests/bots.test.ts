import { describe, expect, it } from 'vitest';
import { Bot } from '../src/bots/Bot';
import { StaticBehavior } from '../src/bots/BotBehaviors';

describe('bot hitboxes', () => {
  it('distinguishes head / body / legs and handles rotation', () => {
    const b = new Bot(150, new StaticBehavior());
    b.spawn(0, 0, -10, 0, 'test');
    for (const yaw of [0, 0.7, Math.PI / 2, 2.5]) {
      b.yaw = yaw;
      const ray = (y: number) => b.raycast({ x: 0, y, z: 0 }, { x: 0, y: 0, z: -1 }, 100);
      expect(ray(1.6)?.zone).toBe('head');
      expect(ray(1.2)?.zone).toBe('body');
      expect(ray(0.4)?.zone).toBe('leg');
      expect(ray(1.9)).toBeNull();
    }
  });
  it('dead bots cannot be hit', () => {
    const b = new Bot(150, new StaticBehavior());
    b.spawn(0, 0, -10, 0, 'test');
    b.kill();
    expect(b.raycast({ x: 0, y: 1.6, z: 0 }, { x: 0, y: 0, z: -1 }, 100)).toBeNull();
  });
});
