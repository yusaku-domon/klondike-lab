import { describe, expect, it } from 'vitest'
import { RANKS, SUITS, createCardId } from './cards'
import { createStandardDeck } from './deck'

describe('createStandardDeck', () => {
  it('creates 52 cards', () => {
    expect(createStandardDeck()).toHaveLength(52)
  })

  it('has no duplicate ids', () => {
    const ids = createStandardDeck().map((card) => card.id)
    expect(new Set(ids).size).toBe(52)
  })

  it('includes every suit/rank combination exactly once', () => {
    const ids = new Set(createStandardDeck().map((card) => card.id))
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        expect(ids.has(createCardId(suit, rank))).toBe(true)
      }
    }
  })

  it('deals every card face down', () => {
    expect(createStandardDeck().every((card) => card.faceUp === false)).toBe(true)
  })

  it('returns an independent array and cards on each call', () => {
    const first = createStandardDeck()
    const second = createStandardDeck()
    expect(first).not.toBe(second)
    expect(first[0]).not.toBe(second[0])

    first[0]!.faceUp = true
    expect(second[0]!.faceUp).toBe(false)
  })
})
