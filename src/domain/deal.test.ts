import { describe, expect, it } from 'vitest'
import { SUITS } from './cards'
import { createInitialGameState } from './deal'
import { isCompleteUniqueDeck } from './invariants'

function allCards(state: ReturnType<typeof createInitialGameState>) {
  return [
    ...state.stock,
    ...state.waste,
    ...state.tableau.flat(),
    ...Object.values(state.foundations).flat(),
  ]
}

describe('createInitialGameState', () => {
  it('deals tableau columns with 1..7 cards, only the last card face up', () => {
    const state = createInitialGameState(42)

    state.tableau.forEach((column, columnIndex) => {
      expect(column).toHaveLength(columnIndex + 1)
      column.forEach((card, cardIndex) => {
        expect(card.faceUp).toBe(cardIndex === column.length - 1)
      })
    })
  })

  it('leaves 24 face-down cards in the stock', () => {
    const state = createInitialGameState(42)
    expect(state.stock).toHaveLength(24)
    expect(state.stock.every((card) => card.faceUp === false)).toBe(true)
  })

  it('starts with an empty waste and empty foundations', () => {
    const state = createInitialGameState(42)
    expect(state.waste).toEqual([])
    for (const suit of SUITS) {
      expect(state.foundations[suit]).toEqual([])
    }
  })

  it('uses all 52 cards exactly once across every pile', () => {
    const state = createInitialGameState(42)
    expect(allCards(state)).toHaveLength(52)
    expect(isCompleteUniqueDeck(allCards(state))).toBe(true)
  })

  it('starts with score 0, elapsedSeconds 0, moveCount 0, and status playing', () => {
    const state = createInitialGameState(42)
    expect(state.score).toBe(0)
    expect(state.elapsedSeconds).toBe(0)
    expect(state.moveCount).toBe(0)
    expect(state.status).toBe('playing')
  })

  it('stamps schema/rules/shuffle/scoring versions and the given seed', () => {
    const state = createInitialGameState(42)
    expect(state.schemaVersion).toBe(1)
    expect(state.rulesVersion).toBe(1)
    expect(state.shuffleVersion).toBe(1)
    expect(state.scoringVersion).toBe(1)
    expect(state.seed).toBe(42)
  })

  it('is deterministic for the same seed', () => {
    const a = createInitialGameState(2026)
    const b = createInitialGameState(2026)
    expect(a).toEqual(b)
  })

  it('deals a different arrangement for a different seed', () => {
    const a = createInitialGameState(1)
    const b = createInitialGameState(2)
    expect(a.tableau).not.toEqual(b.tableau)
  })
})
