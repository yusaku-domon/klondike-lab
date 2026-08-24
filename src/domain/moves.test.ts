import { describe, expect, it } from 'vitest'
import { emptyState } from '../testFixtures'
import { createCard, RANKS, type Card } from './cards'
import { createInitialGameState, type GameState } from './deal'
import { isCompleteUniqueDeck } from './invariants'
import {
  applyMove,
  clickStock,
  drawFromStock,
  getLegalDestinations,
  recycleWaste,
  type MoveCommand,
  type PileRef,
} from './moves'

describe('drawFromStock', () => {
  it('moves the top stock card face up onto the waste', () => {
    const stock = [createCard('clubs', 5, false), createCard('hearts', 9, false)]
    const state = emptyState({ stock })

    const result = drawFromStock(state)

    expect(result.stock).toEqual([createCard('clubs', 5, false)])
    expect(result.waste).toEqual([createCard('hearts', 9, true)])
    expect(result.moveCount).toBe(1)
  })

  it('is a no-op when the stock is empty', () => {
    const state = emptyState()
    expect(drawFromStock(state)).toBe(state)
  })
})

describe('recycleWaste', () => {
  it('is a no-op while the stock still has cards', () => {
    const state = emptyState({ stock: [createCard('clubs', 1, false)] })
    expect(recycleWaste(state)).toBe(state)
  })

  it('is a no-op when there is nothing to recycle', () => {
    const state = emptyState()
    expect(recycleWaste(state)).toBe(state)
  })

  it('flips the waste face down and restores it to the stock, empties the waste', () => {
    const waste = [createCard('clubs', 1, true), createCard('clubs', 2, true)]
    const state = emptyState({ waste })

    const result = recycleWaste(state)

    expect(result.waste).toEqual([])
    expect(result.stock).toEqual([createCard('clubs', 2, false), createCard('clubs', 1, false)])
    expect(result.moveCount).toBe(1)
  })

  it('deducts 100 points, floored at 0', () => {
    const state = emptyState({ waste: [createCard('clubs', 1, true)], score: 50 })
    expect(recycleWaste(state).score).toBe(0)

    const richState = emptyState({ waste: [createCard('clubs', 1, true)], score: 150 })
    expect(recycleWaste(richState).score).toBe(50)
  })

  it('reproduces the original draw order after a recycle', () => {
    let state = emptyState({
      stock: [createCard('clubs', 1, false), createCard('clubs', 2, false), createCard('clubs', 3, false)],
    })

    const firstCycleDraws: Card[] = []
    for (let i = 0; i < 3; i++) {
      state = drawFromStock(state)
      firstCycleDraws.push(state.waste[state.waste.length - 1]!)
    }

    state = recycleWaste(state)

    const secondCycleDraws: Card[] = []
    for (let i = 0; i < 3; i++) {
      state = drawFromStock(state)
      secondCycleDraws.push(state.waste[state.waste.length - 1]!)
    }

    expect(secondCycleDraws.map((c) => c.id)).toEqual(firstCycleDraws.map((c) => c.id))
  })
})

describe('clickStock', () => {
  it('draws when the stock has cards', () => {
    const state = emptyState({ stock: [createCard('clubs', 1, false)] })
    const result = clickStock(state)
    expect(result.waste).toHaveLength(1)
  })

  it('recycles when the stock is empty and the waste has cards', () => {
    const state = emptyState({ waste: [createCard('clubs', 1, true)] })
    const result = clickStock(state)
    expect(result.stock).toHaveLength(1)
    expect(result.waste).toHaveLength(0)
  })

  it('is a no-op when both stock and waste are empty', () => {
    const state = emptyState()
    expect(clickStock(state)).toBe(state)
  })
})

describe('applyMove', () => {
  it('moves a waste card onto an empty tableau column only if it is a King', () => {
    const state = emptyState({ waste: [createCard('spades', 13, true)] })
    const command: MoveCommand = { from: { type: 'waste' }, to: { type: 'tableau', column: 0 } }

    const result = applyMove(state, command)

    expect(result.waste).toEqual([])
    expect(result.tableau[0]).toEqual([createCard('spades', 13, true)])
    expect(result.moveCount).toBe(1)
  })

  it('rejects a non-King onto an empty tableau column', () => {
    const state = emptyState({ waste: [createCard('spades', 5, true)] })
    const command: MoveCommand = { from: { type: 'waste' }, to: { type: 'tableau', column: 0 } }

    expect(applyMove(state, command)).toBe(state)
  })

  it('moves a waste card onto a fitting tableau top card', () => {
    const state = emptyState({
      waste: [createCard('clubs', 8, true)],
      tableau: [[createCard('hearts', 9, true)], [], [], [], [], [], []],
    })
    const command: MoveCommand = { from: { type: 'waste' }, to: { type: 'tableau', column: 0 } }

    const result = applyMove(state, command)

    expect(result.tableau[0]).toEqual([createCard('hearts', 9, true), createCard('clubs', 8, true)])
    expect(result.waste).toEqual([])
  })

  it('moves a full face-up run between tableau columns and flips the newly exposed card', () => {
    const hiddenBase = createCard('diamonds', 10, false)
    const sourceColumn = [hiddenBase, createCard('clubs', 8, true), createCard('hearts', 7, true)]
    const state = emptyState({
      tableau: [sourceColumn, [createCard('hearts', 9, true)], [], [], [], [], []],
    })
    const command: MoveCommand = {
      from: { type: 'tableau', column: 0, cardIndex: 1 },
      to: { type: 'tableau', column: 1 },
    }

    const result = applyMove(state, command)

    expect(result.tableau[0]).toEqual([{ ...hiddenBase, faceUp: true }])
    expect(result.tableau[1]).toEqual([
      createCard('hearts', 9, true),
      createCard('clubs', 8, true),
      createCard('hearts', 7, true),
    ])
    expect(result.moveCount).toBe(1)
  })

  it('rejects selecting a face-down tableau card', () => {
    const state = emptyState({
      tableau: [[createCard('clubs', 8, false)], [], [], [], [], [], []],
    })
    const command: MoveCommand = {
      from: { type: 'tableau', column: 0, cardIndex: 0 },
      to: { type: 'tableau', column: 1 },
    }

    expect(applyMove(state, command)).toBe(state)
  })

  it('rejects an internally invalid run even if selected', () => {
    const invalidColumn = [createCard('clubs', 8, true), createCard('spades', 8, true)]
    const state = emptyState({
      tableau: [invalidColumn, [], [], [], [], [], []],
    })
    const command: MoveCommand = {
      from: { type: 'tableau', column: 0, cardIndex: 0 },
      to: { type: 'tableau', column: 1 },
    }

    expect(applyMove(state, command)).toBe(state)
  })

  it('moves a single tableau card onto a fitting foundation pile', () => {
    const state = emptyState({
      tableau: [[createCard('hearts', 1, true)], [], [], [], [], [], []],
    })
    const command: MoveCommand = {
      from: { type: 'tableau', column: 0, cardIndex: 0 },
      to: { type: 'foundation', suit: 'hearts' },
    }

    const result = applyMove(state, command)

    expect(result.foundations.hearts).toEqual([createCard('hearts', 1, true)])
    expect(result.tableau[0]).toEqual([])
  })

  it('rejects moving a multi-card run onto a foundation', () => {
    const column = [createCard('clubs', 2, true), createCard('hearts', 1, true)]
    const state = emptyState({
      foundations: { clubs: [createCard('clubs', 1, true)], diamonds: [], hearts: [], spades: [] },
      tableau: [column, [], [], [], [], [], []],
    })
    const command: MoveCommand = {
      from: { type: 'tableau', column: 0, cardIndex: 0 },
      to: { type: 'foundation', suit: 'clubs' },
    }

    expect(applyMove(state, command)).toBe(state)
  })

  it('rejects a card whose suit does not match the destination foundation', () => {
    const state = emptyState({ waste: [createCard('hearts', 1, true)] })
    const command: MoveCommand = { from: { type: 'waste' }, to: { type: 'foundation', suit: 'spades' } }

    expect(applyMove(state, command)).toBe(state)
  })

  it('moves the top foundation card back onto a fitting tableau column', () => {
    const state = emptyState({
      foundations: { clubs: [], diamonds: [], hearts: [createCard('hearts', 5, true)], spades: [] },
      tableau: [[createCard('clubs', 6, true)], [], [], [], [], [], []],
    })
    const command: MoveCommand = {
      from: { type: 'foundation', suit: 'hearts' },
      to: { type: 'tableau', column: 0 },
    }

    const result = applyMove(state, command)

    expect(result.foundations.hearts).toEqual([])
    expect(result.tableau[0]).toEqual([createCard('clubs', 6, true), createCard('hearts', 5, true)])
  })

  it('rejects moving a pile onto itself', () => {
    const state = emptyState({ tableau: [[createCard('spades', 13, true)], [], [], [], [], [], []] })
    const command: MoveCommand = {
      from: { type: 'tableau', column: 0, cardIndex: 0 },
      to: { type: 'tableau', column: 0 },
    }

    expect(applyMove(state, command)).toBe(state)
  })

  it('never allows moving directly from the stock', () => {
    const state = emptyState({ stock: [createCard('spades', 13, false)] })
    const command: MoveCommand = { from: { type: 'stock' }, to: { type: 'tableau', column: 0 } }

    expect(applyMove(state, command)).toBe(state)
  })

  it('awards +5 for waste to tableau', () => {
    const state = emptyState({ waste: [createCard('spades', 13, true)] })
    const command: MoveCommand = { from: { type: 'waste' }, to: { type: 'tableau', column: 0 } }
    expect(applyMove(state, command).score).toBe(5)
  })

  it('awards +10 for waste to foundation', () => {
    const state = emptyState({ waste: [createCard('hearts', 1, true)] })
    const command: MoveCommand = { from: { type: 'waste' }, to: { type: 'foundation', suit: 'hearts' } }
    expect(applyMove(state, command).score).toBe(10)
  })

  it('awards +10 for tableau to foundation, plus +5 for the card newly exposed underneath', () => {
    const hiddenBase = createCard('clubs', 2, false)
    const state = emptyState({ tableau: [[hiddenBase, createCard('hearts', 1, true)], [], [], [], [], [], []] })
    const command: MoveCommand = {
      from: { type: 'tableau', column: 0, cardIndex: 1 },
      to: { type: 'foundation', suit: 'hearts' },
    }

    const result = applyMove(state, command)

    expect(result.score).toBe(15)
    expect(result.tableau[0]).toEqual([{ ...hiddenBase, faceUp: true }])
  })

  it('penalizes -15 for foundation to tableau, floored at 0', () => {
    const state = emptyState({
      score: 10,
      foundations: { clubs: [], diamonds: [], hearts: [createCard('hearts', 5, true)], spades: [] },
      tableau: [[createCard('clubs', 6, true)], [], [], [], [], [], []],
    })
    const command: MoveCommand = { from: { type: 'foundation', suit: 'hearts' }, to: { type: 'tableau', column: 0 } }

    expect(applyMove(state, command).score).toBe(0)
  })

  it('awards 0 for tableau to tableau', () => {
    const state = emptyState({
      score: 20,
      tableau: [[createCard('clubs', 8, true)], [createCard('hearts', 9, true)], [], [], [], [], []],
    })
    const command: MoveCommand = {
      from: { type: 'tableau', column: 0, cardIndex: 0 },
      to: { type: 'tableau', column: 1 },
    }

    expect(applyMove(state, command).score).toBe(20)
  })

  it('sets status to won once all four foundations are complete', () => {
    const state = emptyState({
      foundations: {
        clubs: RANKS.slice(0, 13).map((rank) => createCard('clubs', rank, true)),
        diamonds: RANKS.slice(0, 13).map((rank) => createCard('diamonds', rank, true)),
        spades: RANKS.slice(0, 13).map((rank) => createCard('spades', rank, true)),
        hearts: RANKS.slice(0, 12).map((rank) => createCard('hearts', rank, true)),
      },
      tableau: [[createCard('hearts', 13, true)], [], [], [], [], [], []],
    })
    const command: MoveCommand = {
      from: { type: 'tableau', column: 0, cardIndex: 0 },
      to: { type: 'foundation', suit: 'hearts' },
    }

    const result = applyMove(state, command)

    expect(result.foundations.hearts).toHaveLength(13)
    expect(result.status).toBe('won')
  })
})

describe('getLegalDestinations', () => {
  it('is empty when the source has no movable cards', () => {
    const state = emptyState()
    expect(getLegalDestinations(state, { type: 'waste' })).toEqual([])
    expect(getLegalDestinations(state, { type: 'stock' })).toEqual([])
  })

  it('is empty when no pile can currently accept the selected card', () => {
    const state = emptyState({
      waste: [createCard('hearts', 5, true)],
      tableau: [[createCard('clubs', 9, true)], [], [], [], [], [], []],
    })
    expect(getLegalDestinations(state, { type: 'waste' })).toEqual([])
  })

  it('finds a single destination', () => {
    const state = emptyState({
      waste: [createCard('clubs', 8, true)],
      tableau: [[createCard('hearts', 9, true)], [], [], [], [], [], []],
    })
    expect(getLegalDestinations(state, { type: 'waste' })).toEqual([
      { type: 'tableau', column: 0 },
    ])
  })

  it('finds multiple destinations across several empty tableau columns', () => {
    const state = emptyState({ waste: [createCard('spades', 13, true)] })
    expect(getLegalDestinations(state, { type: 'waste' })).toEqual([
      { type: 'tableau', column: 0 },
      { type: 'tableau', column: 1 },
      { type: 'tableau', column: 2 },
      { type: 'tableau', column: 3 },
      { type: 'tableau', column: 4 },
      { type: 'tableau', column: 5 },
      { type: 'tableau', column: 6 },
    ])
  })

  it('includes a fitting foundation alongside a fitting tableau column for a single card', () => {
    const state = emptyState({
      waste: [createCard('hearts', 1, true)],
      tableau: [[createCard('clubs', 2, true)], [], [], [], [], [], []],
    })
    expect(getLegalDestinations(state, { type: 'waste' })).toEqual([
      { type: 'tableau', column: 0 },
      { type: 'foundation', suit: 'hearts' },
    ])
  })

  it('never offers a foundation of a different suit, even while that foundation is empty', () => {
    const state = emptyState({ waste: [createCard('hearts', 1, true)] })
    const destinations = getLegalDestinations(state, { type: 'waste' })
    expect(destinations.filter((d) => d.type === 'foundation')).toEqual([
      { type: 'foundation', suit: 'hearts' },
    ])
  })

  it('excludes foundations entirely for a multi-card run, even if the bottom card would fit alone', () => {
    const run = [createCard('clubs', 2, true), createCard('hearts', 1, true)]
    const state = emptyState({
      foundations: { clubs: [createCard('clubs', 1, true)], diamonds: [], hearts: [], spades: [] },
      tableau: [run, [createCard('hearts', 9, true)], [], [], [], [], []],
    })
    expect(getLegalDestinations(state, { type: 'tableau', column: 0, cardIndex: 0 })).toEqual([])
  })

  it('finds a tableau destination for a valid multi-card run', () => {
    const run = [createCard('clubs', 8, true), createCard('hearts', 7, true)]
    const state = emptyState({
      tableau: [run, [createCard('hearts', 9, true)], [], [], [], [], []],
    })
    expect(getLegalDestinations(state, { type: 'tableau', column: 0, cardIndex: 0 })).toEqual([
      { type: 'tableau', column: 1 },
    ])
  })

  it('excludes the source pile itself', () => {
    const state = emptyState({
      foundations: { clubs: [], diamonds: [], hearts: [createCard('hearts', 5, true)], spades: [] },
    })
    const destinations = getLegalDestinations(state, { type: 'foundation', suit: 'hearts' })
    expect(destinations.some((d) => d.type === 'foundation' && d.suit === 'hearts')).toBe(false)
  })

  it('rejects a card whose suit does not match any foundation', () => {
    const state = emptyState({ waste: [createCard('hearts', 5, true)] })
    const destinations = getLegalDestinations(state, { type: 'waste' })
    expect(destinations.some((d) => d.type === 'foundation')).toBe(false)
  })
})

describe('52-card invariant across a played-out sequence', () => {
  function allCards(state: GameState): Card[] {
    return [
      ...state.stock,
      ...state.waste,
      ...state.tableau.flat(),
      ...Object.values(state.foundations).flat(),
    ]
  }

  const DESTINATIONS: MoveCommand['to'][] = [
    { type: 'foundation', suit: 'clubs' },
    { type: 'foundation', suit: 'diamonds' },
    { type: 'foundation', suit: 'hearts' },
    { type: 'foundation', suit: 'spades' },
    ...Array.from({ length: 7 }, (_, column) => ({ type: 'tableau' as const, column })),
  ]

  const SOURCES: PileRef[] = [
    { type: 'stock' },
    { type: 'waste' },
    { type: 'foundation', suit: 'clubs' },
    { type: 'foundation', suit: 'diamonds' },
    { type: 'foundation', suit: 'hearts' },
    { type: 'foundation', suit: 'spades' },
    ...Array.from({ length: 7 }, (_, column) => ({ type: 'tableau' as const, column })),
  ]

  it('never gains, loses, or duplicates a card across many legal and illegal operations', () => {
    for (const seed of [1, 42, 2026, 0xdeadbeef]) {
      let state = createInitialGameState(seed)
      expect(isCompleteUniqueDeck(allCards(state))).toBe(true)

      for (let step = 0; step < 300; step++) {
        if (step % 3 === 0) {
          state = clickStock(state)
        } else {
          const source = SOURCES[step % SOURCES.length]!
          const to = DESTINATIONS[(step * 7 + 3) % DESTINATIONS.length]!
          const from: PileRef =
            source.type === 'tableau' ? { ...source, cardIndex: step % 8 } : source
          state = applyMove(state, { from, to })
        }

        expect(state.tableau).toHaveLength(7)
        expect(isCompleteUniqueDeck(allCards(state))).toBe(true)
      }
    }
  })
})
