import type { Rank } from '../domain/cards'

export interface PipPosition {
  /** Horizontal position within the card's pip area, in percent (0/50/100
   * for left/center/right). */
  x: number
  /** Vertical position within the card's pip area, in percent (0/25/50/75/
   * 100, top to bottom). */
  y: number
  /** Pips in the bottom half are drawn upside down, matching every real
   * deck's point-symmetric card face — so the card reads the same way up
   * no matter which end faces the viewer. */
  rotated?: boolean
}

/**
 * Simplified, grid-based approximation of the traditional French-suited
 * pip layouts for number cards 2–10 — a fixed 3-column (left/center/right)
 * by 5-row (top to bottom) grid, not a pixel-exact reproduction of any one
 * historical deck (real decks offset the two extra pips on a 10 between
 * rows; here they line up with the existing grid rows instead). Aces and
 * face cards (J/Q/K) are handled separately by PlayingCard.vue and never
 * look here.
 */
export const PIP_LAYOUTS: Partial<Record<Rank, PipPosition[]>> = {
  2: [
    { x: 50, y: 0 },
    { x: 50, y: 100, rotated: true },
  ],
  3: [
    { x: 50, y: 0 },
    { x: 50, y: 50 },
    { x: 50, y: 100, rotated: true },
  ],
  4: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 100, rotated: true },
    { x: 100, y: 100, rotated: true },
  ],
  5: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 50, y: 50 },
    { x: 0, y: 100, rotated: true },
    { x: 100, y: 100, rotated: true },
  ],
  6: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 50 },
    { x: 100, y: 50 },
    { x: 0, y: 100, rotated: true },
    { x: 100, y: 100, rotated: true },
  ],
  7: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 50 },
    { x: 50, y: 50 },
    { x: 100, y: 50 },
    { x: 0, y: 100, rotated: true },
    { x: 100, y: 100, rotated: true },
  ],
  8: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 50, y: 25 },
    { x: 0, y: 50 },
    { x: 100, y: 50 },
    { x: 50, y: 75, rotated: true },
    { x: 0, y: 100, rotated: true },
    { x: 100, y: 100, rotated: true },
  ],
  9: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 25 },
    { x: 100, y: 25 },
    { x: 50, y: 50 },
    { x: 0, y: 75, rotated: true },
    { x: 100, y: 75, rotated: true },
    { x: 0, y: 100, rotated: true },
    { x: 100, y: 100, rotated: true },
  ],
  10: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 25 },
    { x: 100, y: 25 },
    { x: 0, y: 50 },
    { x: 100, y: 50 },
    { x: 0, y: 75, rotated: true },
    { x: 100, y: 75, rotated: true },
    { x: 0, y: 100, rotated: true },
    { x: 100, y: 100, rotated: true },
  ],
}
