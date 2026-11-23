import { v } from './provenance';

/**
 * Core "feel" constants that make muscle memory transfer from the reference game.
 * These are the most important numbers in the project.
 */
export const REFERENCE = {
  /** Degrees of view rotation per mouse count at sensitivity 1.0. */
  yawDegPerCount: v(0.07, 'community', 'Used by all major sensitivity converters; verify with a 360° distance test.'),
  /** Pitch uses the same scale as yaw (no separate vertical multiplier by default). */
  pitchDegPerCount: v(0.07, 'community'),
  /** Fixed horizontal FOV (the reference game does not let users change it). */
  horizontalFovDeg: v(103, 'official', 'Horizontal FOV is fixed at 103° (16:9). Behaviour on non-16:9 aspect ratios is approximated (horizontal kept).'),
  /** Server simulation rate. We simulate movement/shooting at the same fixed rate. */
  tickRate: v(128, 'official', 'Reference servers run at 128 tick.'),
  /** Pitch clamp. */
  maxPitchDeg: v(89, 'estimate'),
} as const;
