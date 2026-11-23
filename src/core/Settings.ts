import { REFERENCE } from '../config/reference';

export type ModeId = 'free' | 'flick' | 'stopping';
export type Quality = 'low' | 'medium' | 'high';
export type BotBehaviorSetting = 'strafe' | 'static' | 'mixed';

export interface CrosshairSettings {
  color: string;
  length: number; // px, inner line length (0 = no lines)
  thickness: number; // px
  gap: number; // px offset from centre
  outline: boolean;
  outlineOpacity: number;
  centerDot: boolean;
  opacity: number;
  showFiringError: boolean;
}

export interface Settings {
  sensitivity: number; // reference-game in-game sensitivity
  dpi: number;
  scopedMultiplier: number;
  invertY: boolean;
  rawInput: boolean;
  adsMode: 'hold' | 'toggle';
  crosshair: CrosshairSettings;
  weaponId: string;
  mode: ModeId;
  botCount: number;
  botSpeed: number; // m/s
  botHp: number;
  botBehavior: BotBehaviorSetting;
  practiceDuration: 30 | 60;
  infiniteAmmo: boolean;
  quality: Quality;
  volume: number;
  keyboardLock: boolean;
  showSpeedometer: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 0.4,
  dpi: 800,
  scopedMultiplier: 1.0,
  invertY: false,
  rawInput: true,
  adsMode: 'hold',
  crosshair: {
    color: '#00ff9c', length: 5, thickness: 2, gap: 3, outline: true, outlineOpacity: 0.6,
    centerDot: false, opacity: 1, showFiringError: false,
  },
  weaponId: 'rifle_v',
  mode: 'free',
  botCount: 6,
  botSpeed: 3.5,
  botHp: 150,
  botBehavior: 'mixed',
  practiceDuration: 60,
  infiniteAmmo: false,
  quality: 'medium',
  volume: 0.5,
  keyboardLock: false,
  showSpeedometer: false,
};

const KEY = 'aim-protocol.settings.v1';

const clamp = (x: unknown, lo: number, hi: number, d: number) =>
  typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d;

export function sanitize(raw: Partial<Settings> | null | undefined): Settings {
  const d = DEFAULT_SETTINGS;
  const r = (raw ?? {}) as Partial<Settings>;
  const ch = { ...d.crosshair, ...(r.crosshair ?? {}) };
  const s: Settings = { ...d, ...r, crosshair: ch };
  s.sensitivity = clamp(s.sensitivity, 0.01, 10, d.sensitivity);
  s.dpi = clamp(s.dpi, 50, 32000, d.dpi);
  s.scopedMultiplier = clamp(s.scopedMultiplier, 0.01, 5, d.scopedMultiplier);
  s.botCount = Math.round(clamp(s.botCount, 1, 20, d.botCount));
  s.botSpeed = clamp(s.botSpeed, 0, 6.75, d.botSpeed);
  s.botHp = Math.round(clamp(s.botHp, 1, 1000, d.botHp));
  s.volume = clamp(s.volume, 0, 1, d.volume);
  s.practiceDuration = s.practiceDuration === 30 ? 30 : 60;
  if (!['free', 'flick', 'stopping'].includes(s.mode)) s.mode = d.mode;
  if (!['low', 'medium', 'high'].includes(s.quality)) s.quality = d.quality;
  if (!['strafe', 'static', 'mixed'].includes(s.botBehavior)) s.botBehavior = d.botBehavior;
  if (!/^#[0-9a-fA-F]{6}$/.test(ch.color)) ch.color = d.crosshair.color;
  ch.length = clamp(ch.length, 0, 30, d.crosshair.length);
  ch.thickness = clamp(ch.thickness, 1, 10, d.crosshair.thickness);
  ch.gap = clamp(ch.gap, 0, 30, d.crosshair.gap);
  ch.outlineOpacity = clamp(ch.outlineOpacity, 0, 1, d.crosshair.outlineOpacity);
  ch.opacity = clamp(ch.opacity, 0.1, 1, d.crosshair.opacity);
  return s;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return sanitize(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitize(null);
  }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

/** Radians of rotation per mouse count (hip-fire). */
export function radPerCount(s: Settings): number {
  return (REFERENCE.yawDegPerCount.value * s.sensitivity * Math.PI) / 180;
}

/** Physical mouse distance for a full 360° turn (cm). */
export function cmPer360(s: Settings): number {
  const counts = 360 / (REFERENCE.yawDegPerCount.value * s.sensitivity);
  return (counts / s.dpi) * 2.54;
}

export const eDPI = (s: Settings) => s.sensitivity * s.dpi;
