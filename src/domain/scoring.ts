import type { Suit } from './cards'

export const SCORING_VERSION = 1 as const

export type SourcePileType = 'stock' | 'waste' | 'tableau' | 'foundation'
export type DestinationPileType = 'tableau' | 'foundation'

export const RECYCLE_WASTE_PENALTY = -100
export const TABLEAU_FLIP_BONUS = 5

export function scoreForMove(from: SourcePileType, to: DestinationPileType): number {
  if (from === 'waste' && to === 'tableau') return 5
  if (from === 'waste' && to === 'foundation') return 10
  if (from === 'tableau' && to === 'foundation') return 10
  if (from === 'foundation' && to === 'tableau') return -15
  if (from === 'tableau' && to === 'tableau') return 0
  return 0
}

export function applyScoreDelta(score: number, delta: number): number {
  return Math.max(0, score + delta)
}

export function hasWon(foundations: Record<Suit, readonly unknown[]>): boolean {
  return Object.values(foundations).every((pile) => pile.length === 13)
}
