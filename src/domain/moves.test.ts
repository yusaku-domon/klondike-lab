import { describe, expect, it } from 'vitest'
import { createCard, type Card } from './cards'
import type { GameState } from './deal'
import { applyMove, clickStock, drawFromStock, recycleWaste, type MoveCommand } from './moves'

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
})
