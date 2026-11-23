import { v } from './provenance';

/**
 * Player movement parameters (metres, seconds).
 * Model: Source/Unreal-like ground friction + acceleration, which naturally produces
 * "counter-strafing" (pressing the opposite key stops you faster than releasing).
 */
export const MOVEMENT = {
  runSpeed: v(6.75, 'community', '675 cm/s base run speed (knife/most guns). Weapon multipliers applied on top.'),
  walkMultiplier: v(0.6, 'estimate', 'Shift-walk speed ratio.'),
  crouchMultiplier: v(0.5, 'estimate', 'Crouch-walk speed ratio.'),

  groundAccel: v(11, 'estimate', 'Source-style accelerate factor (accel * wishSpeed * dt).'),
  groundFriction: v(9, 'estimate', 'Exponential friction factor while grounded.'),
  stopSpeed: v(1.5, 'estimate', 'Below this speed friction acts as if speed == stopSpeed (fast final stop).'),

  airAccel: v(1.2, 'estimate', 'Low air control.'),
  airWishSpeedCap: v(0.9, 'estimate', 'Max wish speed contribution in air (m/s).'),

  gravity: v(20, 'estimate', 'Tuned so a jump lasts ~0.6s.'),
  jumpVelocity: v(6.0, 'estimate', 'Gives ~0.9m jump apex.'),

  standHeight: v(1.75, 'estimate'),
  crouchHeight: v(1.2, 'estimate'),
  standEye: v(1.6, 'estimate'),
  crouchEye: v(1.1, 'estimate'),
  crouchTransitionTime: v(0.12, 'estimate', 'Seconds to fully crouch / stand.'),
  radius: v(0.35, 'estimate', 'Half width of the player collision box.'),
  stepHeight: v(0.42, 'estimate', 'Max ledge height that is stepped up automatically.'),
} as const;
