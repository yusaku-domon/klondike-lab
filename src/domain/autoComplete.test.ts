import { describe, expect, it } from 'vitest'
import { createCard, RANKS, type Rank } from './cards'
import type { GameState } from './deal'
import { autoCompleteAll, canAutoComplete } from './autoComplete'

function emptyState(overrides: Partial<GameState> = {}): GameState {
  return {
    schemaVersion: 1,
    rulesVersion: 1,
    shuffleVersion: 1,
    scoringVersion: 1,
    seed: 0,
    stock: [],
    waste: [],
    tableau: [[], [], [], [], [], [], []],
    foundations: { clubs: [], diamonds: [], hearts: [], spades: [] },
    score: 0,
    elapsedSeconds: 0,
    status: 'playing',
    moveCount: 0,
    ...overrides,
  }
}

// King-to-Ace order so index0 (bottom) is King and the last index (top) is
// Ace — exposing exactly the next rank each suit's foundation needs.
const descendingRanks: Rank[] = [...RANKS].reverse()

describe('canAutoComplete', () => {
  it('is false while the stock still has cards', () => {
    const state = emptyState({ stock: [createCard('clubs', 1, false)] })
    expect(canAutoComplete(state)).toBe(false)
  })

  it('is false while any tableau card is face down', () => {
    const state = emptyState({
      tableau: [[createCard('clubs', 5, false), createCard('clubs', 4, true)], [], [], [], [], [], []],
    })
    expect(canAutoComplete(state)).toBe(false)
  })

  it('is false when not playing', () => {
    const state = emptyState({ status: 'paused' })
    expect(canAutoComplete(state)).toBe(false)
  })

  it('is true once the stock is empty and every tableau card is face up', () => {
    const state = emptyState({
      tableau: [[createCard('clubs', 5, true), createCard('hearts', 4, true)], [], [], [], [], [], []],
    })
    expect(canAutoComplete(state)).toBe(true)
  })
})

describe('autoCompleteAll', () => {
  it('fully clears a board where every column already exposes the next needed rank', () => {
    const state = emptyState({
      tableau: [
        descendingRanks.map((rank) => createCard('clubs', rank, true)),
        descendingRanks.map((rank) => createCard('diamonds', rank, true)),
        descendingRanks.map((rank) => createCard('hearts', rank, true)),
        descendingRanks.map((rank) => createCard('spades', rank, true)),
        [],
        [],
        [],
      ],
    })

    const result = autoCompleteAll(state)

    expect(result.status).toBe('won')
    expect(result.foundations.clubs).toHaveLength(13)
    expect(result.foundations.diamonds).toHaveLength(13)
    expect(result.foundations.hearts).toHaveLength(13)
    expect(result.foundations.spades).toHaveLength(13)
    expect(result.tableau.every((column) => column.length === 0)).toBe(true)
  })

  it('prefers the waste top card when it is also eligible', () => {
    const state = emptyState({ waste: [createCard('hearts', 1, true)] })
    const result = autoCompleteAll(state)
    expect(result.foundations.hearts).toEqual([createCard('hearts', 1, true)])
    expect(result.waste).toEqual([])
  })

  it('stops (without throwing) when a pile is stuck behind a card it does not need yet', () => {
    // hearts-2 sits on top of hearts-A in the SAME pile, so hearts-A can
    // never surface via foundation-only moves: this is the documented
    // "auto-complete may stop short" case, not a solver failure.
    const stuckColumn = [createCard('hearts', 1, true), createCard('hearts', 2, true)]
    const state = emptyState({ tableau: [stuckColumn, [], [], [], [], [], []] })

    const result = autoCompleteAll(state)

    expect(result).toBe(state)
    expect(result.foundations.hearts).toEqual([])
  })

  it('is a no-op when there is nothing eligible to move', () => {
    const state = emptyState()
    expect(autoCompleteAll(state)).toBe(state)
  })
})
