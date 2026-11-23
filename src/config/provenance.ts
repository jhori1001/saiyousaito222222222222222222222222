/**
 * Every gameplay number in this project carries a provenance tag so that
 * estimates are never mistaken for confirmed reproduction values.
 *
 *  - 'official'  : value shown in the reference game's in-game stats / patch notes
 *                  as known at development time. STILL needs re-verification against
 *                  the current live patch before being treated as exact.
 *  - 'community' : value measured and widely used by the player community
 *                  (e.g. sensitivity converters). Not published by the developer.
 *  - 'estimate'  : our own provisional value chosen by feel / reasoning.
 *                  MUST be tuned against the real game.
 */
export type Provenance = 'official' | 'community' | 'estimate';

export interface Sourced<T> {
  value: T;
  src: Provenance;
  note?: string;
}

export const v = <T>(value: T, src: Provenance, note?: string): Sourced<T> => ({ value, src, note });
