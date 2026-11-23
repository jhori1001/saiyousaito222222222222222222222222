import type { Bot } from '../bots/Bot';
import type { BotManager } from '../bots/BotManager';
import type { ModeId, Settings } from '../core/Settings';
import type { MapData } from '../map/MapData';
import type { ShotRecord, Stats } from '../stats/Stats';

/** Narrow API the modes get from the game, so modes stay decoupled from rendering. */
export interface ModeHost {
  settings: Settings;
  bots: BotManager;
  stats: Stats;
  map: MapData;
  now: number;
  eye(): { x: number; y: number; z: number };
  yaw(): number;
  spawnPlayer(key: string): void;
  finish(): void;
}

export interface PracticeMode {
  readonly id: ModeId;
  readonly label: string;
  /** Seconds remaining (timed modes) or null. */
  timeLeft: number | null;
  start(host: ModeHost): void;
  tick(dt: number, host: ModeHost): void;
  onKill(bot: Bot, host: ModeHost): void;
  onShot(rec: ShotRecord, host: ModeHost): void;
  /** Extra HUD html (stopping analysis etc). */
  hud(host: ModeHost, live: { speed: number; spread: number; accurate: boolean }): string;
}
