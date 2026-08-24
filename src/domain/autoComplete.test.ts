import { describe, expect, it } from 'vitest'
import { emptyState } from '../testFixtures'
import { createCard, RANKS, type Rank } from './cards'
import { autoCompleteAll, autoCompleteSteps, canAutoComplete } from './autoComplete'

// King-to-Ace order so index0 (bottom) is King and the last index (top) is
// Ace — exposing exactly the next rank each suit's foundation needs.
const descendingRanks: Rank[] = [...RANKS].reverse()

describe('canAutoComplete', () => {
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

  it('is true once every tableau card is face up', () => {
    const state = emptyState({
      tableau: [[createCard('clubs', 5, true), createCard('hearts', 4, true)], [], [], [], [], [], []],
    })
    expect(canAutoComplete(state)).toBe(true)
  })

  it('is true with every tableau card face up even while the stock still has cards', () => {
    const state = emptyState({
      stock: [createCard('spades', 1, false), createCard('spades', 2, false)],
      tableau: [[createCard('clubs', 5, true)], [], [], [], [], [], []],
    })
    expect(canAutoComplete(state)).toBe(true)
  })

  it('is true with every tableau card face up even while the waste still has cards', () => {
    const state = emptyState({
      waste: [createCard('spades', 1, true)],
      tableau: [[createCard('clubs', 5, true)], [], [], [], [], [], []],
    })
    expect(canAutoComplete(state)).toBe(true)
  })

  it('is true with every tableau card face up regardless of stock and waste contents combined', () => {
    const state = emptyState({
      stock: [createCard('spades', 3, false)],
      waste: [createCard('spades', 1, true), createCard('spades', 2, true)],
      tableau: [[createCard('clubs', 5, true)], [], [], [], [], [], []],
    })
    expect(canAutoComplete(state)).toBe(true)
  })

  it('is true for a fully empty tableau (vacuously no face-down card), regardless of stock/waste', () => {
    const state = emptyState({ stock: [createCard('clubs', 1, false)] })
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

  it('cycles the stock to reach a card buried under the waste top', () => {
    // Ace of hearts is not directly reachable — the King of spades on top
    // of it is never foundation-eligible on its own. Since the stock is
    // empty (a precondition of auto-complete being offered), the only way
    // to reach it is to recycle the waste back into the stock and redraw.
    const state = emptyState({
      waste: [createCard('hearts', 1, true), createCard('spades', 13, true)],
    })

    const result = autoCompleteAll(state)

    expect(result.foundations.hearts).toEqual([createCard('hearts', 1, true)])
  })

  it('unlocks a tableau card that was waiting on a card buried in the waste', () => {
    const state = emptyState({
      waste: [createCard('hearts', 1, true), createCard('spades', 13, true)],
      tableau: [[createCard('hearts', 2, true)], [], [], [], [], [], []],
    })

    const result = autoCompleteAll(state)

    expect(result.foundations.hearts).toEqual([
      createCard('hearts', 1, true),
      createCard('hearts', 2, true),
    ])
    expect(result.tableau[0]).toEqual([])
  })

  it('gives up after a full cycle finds no further progress, without looping forever', () => {
    const state = emptyState({
      waste: [createCard('spades', 13, true), createCard('hearts', 13, true)],
    })

    const result = autoCompleteAll(state)

    expect(result.foundations.spades).toEqual([])
    expect(result.foundations.hearts).toEqual([])
    expect(result.stock.length + result.waste.length).toBe(2)
  })
})

describe('autoCompleteSteps', () => {
  it('is empty when there is nothing eligible to move', () => {
    const state = emptyState()
    expect(autoCompleteSteps(state)).toEqual([])
  })

  it("its last entry equals autoCompleteAll's result", () => {
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

    const steps = autoCompleteSteps(state)
    const all = autoCompleteAll(state)

    expect(steps.length).toBeGreaterThan(0)
    expect(steps[steps.length - 1]).toEqual(all)
  })

  it('moves exactly one card at a time, each state differing from the previous by a single relocated card', () => {
    const state = emptyState({
      foundations: { clubs: [createCard('clubs', 4, true)], diamonds: [], hearts: [], spades: [] },
      tableau: [
        [createCard('clubs', 5, true)],
        [createCard('hearts', 1, true)],
        [],
        [],
        [],
        [],
        [],
      ],
    })

    const steps = autoCompleteSteps(state)

    expect(steps).toHaveLength(2)
    // Step 1: clubs-5 (column 0) joins the foundation; column 1 untouched.
    expect(steps[0]!.foundations.clubs).toEqual([createCard('clubs', 4, true), createCard('clubs', 5, true)])
    expect(steps[0]!.tableau[0]).toEqual([])
    expect(steps[0]!.tableau[1]).toEqual([createCard('hearts', 1, true)])
    // Step 2: hearts-1 (column 1) joins next, independently of step 1.
    expect(steps[1]!.foundations.hearts).toEqual([createCard('hearts', 1, true)])
    expect(steps[1]!.tableau[1]).toEqual([])
  })

  it('records one step per stock click while cycling to reach a buried card', () => {
    const state = emptyState({
      waste: [createCard('hearts', 1, true), createCard('spades', 13, true)],
    })

    const steps = autoCompleteSteps(state)

    // recycle, redraw hearts-1 (pop order surfaces it before spades-13),
    // move hearts-1 to its foundation, redraw spades-13, recycle again and
    // give up (spades-13 alone can never become eligible) = 5 steps.
    expect(steps).toHaveLength(5)
    expect(steps[steps.length - 1]!.foundations.hearts).toEqual([createCard('hearts', 1, true)])
  })

  it('returns no steps (not a one-element array) when stuck immediately', () => {
    const stuckColumn = [createCard('hearts', 1, true), createCard('hearts', 2, true)]
    const state = emptyState({ tableau: [stuckColumn, [], [], [], [], [], []] })

    expect(autoCompleteSteps(state)).toEqual([])
  })
})
