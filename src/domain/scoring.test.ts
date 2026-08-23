import { describe, expect, it } from 'vitest'
import { RANKS, createCard } from './cards'
import { createStandardDeck } from './deck'
import {
  applyScoreDelta,
  hasWon,
  RECYCLE_WASTE_PENALTY,
  scoreForMove,
  TABLEAU_FLIP_BONUS,
} from './scoring'

describe('scoreForMove', () => {
  it('awards +5 for waste to tableau', () => {
    expect(scoreForMove('waste', 'tableau')).toBe(5)
  })

  it('awards +10 for waste to foundation', () => {
    expect(scoreForMove('waste', 'foundation')).toBe(10)
  })

  it('awards +10 for tableau to foundation', () => {
    expect(scoreForMove('tableau', 'foundation')).toBe(10)
  })

  it('awards 0 for tableau to tableau', () => {
    expect(scoreForMove('tableau', 'tableau')).toBe(0)
  })

  it('penalizes -15 for foundation to tableau', () => {
    expect(scoreForMove('foundation', 'tableau')).toBe(-15)
  })
})

describe('constants', () => {
  it('exposes the recycle penalty and flip bonus from the spec', () => {
    expect(RECYCLE_WASTE_PENALTY).toBe(-100)
    expect(TABLEAU_FLIP_BONUS).toBe(5)
  })
})

describe('applyScoreDelta', () => {
  it('adds a positive delta', () => {
    expect(applyScoreDelta(100, 10)).toBe(110)
  })

  it('adds a compound delta (move + flip) in one call', () => {
    expect(applyScoreDelta(0, 5 + 5)).toBe(10)
  })

  it('never drops the score below 0', () => {
    expect(applyScoreDelta(50, RECYCLE_WASTE_PENALTY)).toBe(0)
    expect(applyScoreDelta(0, -15)).toBe(0)
  })
})

describe('hasWon', () => {
  it('is false for empty foundations', () => {
    expect(hasWon({ clubs: [], diamonds: [], hearts: [], spades: [] })).toBe(false)
  })

  it('is false when only some suits are complete', () => {
    const fullSuit = createStandardDeck().filter((card) => card.suit === 'hearts')
    expect(
      hasWon({ clubs: [], diamonds: [], hearts: fullSuit, spades: [] }),
    ).toBe(false)
  })

  it('is true only when all four suits have all 13 ranks', () => {
    const deck = createStandardDeck()
    const bySuit = {
      clubs: deck.filter((c) => c.suit === 'clubs'),
      diamonds: deck.filter((c) => c.suit === 'diamonds'),
      hearts: deck.filter((c) => c.suit === 'hearts'),
      spades: deck.filter((c) => c.suit === 'spades'),
    }
    expect(hasWon(bySuit)).toBe(true)
  })

  it('does not care about card identity, only pile length', () => {
    const thirteen = RANKS.map((rank) => createCard('hearts', rank, true))
    expect(
      hasWon({ clubs: thirteen, diamonds: thirteen, hearts: thirteen, spades: thirteen }),
    ).toBe(true)
  })
})
