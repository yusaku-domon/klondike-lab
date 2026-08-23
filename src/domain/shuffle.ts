import type { Card } from './cards'

export const SHUFFLE_VERSION = 1 as const

export type ShuffleSeed = number

function mulberry32(seed: ShuffleSeed): () => number {
  let state = seed >>> 0
  return function random(): number {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffleDeck(deck: readonly Card[], seed: ShuffleSeed): Card[] {
  const result = deck.map((card) => ({ ...card }))
  const random = mulberry32(seed)

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const swap = result[i]!
    result[i] = result[j]!
    result[j] = swap
  }

  return result
}
