/**
 * Engine-independent map description. Any map (original or a future licensed one)
 * only needs to be converted into this format to be playable.
 */
export type V3 = [number, number, number];

export type SurfaceKind = 'floor' | 'wall' | 'outer' | 'crate' | 'crateDark' | 'platform' | 'trim' | 'stair';

export interface MapBox {
  min: V3;
  max: V3;
  kind: SurfaceKind;
}

export interface SpawnPoint { pos: V3; yawDeg: number }

/** Rectangular area where bots may spawn. y = floor height. */
export interface BotZone {
  id: string;
  min: [number, number]; // x, z
  max: [number, number];
  y: number;
  tags: string[];
}

export interface MapData {
  id: string;
  name: string;
  /** For licensed maps: where the data came from and its licence status. */
  license: { owner: string; status: 'original' | 'licensed' | 'placeholder' };
  boxes: MapBox[];
  playerSpawns: Record<string, SpawnPoint>;
  botZones: BotZone[];
  /** Fixed bot positions for specific drills (e.g. stopping practice). */
  fixedTargets: Record<string, V3[]>;
  sky: { top: number; bottom: number; fog: number; fogNear: number; fogFar: number };
}
