// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createCard } from '../domain/cards'
import { createInitialGameState, type GameState } from '../domain/deal'
import { isCompleteUniqueDeck } from '../domain/invariants'
import type { MoveCommand } from '../domain/moves'
import { loadGame, STORAGE_KEY } from '../persistence/gameStorage'
import { useGameStore } from './game'

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

function allCards(state: GameState) {
  return [
    ...state.stock,
    ...state.waste,
    ...state.tableau.flat(),
    ...Object.values(state.foundations).flat(),
  ]
}

// Reads the raw persisted payload without loadGame()'s strict 52-card
// validation, since several fixtures above intentionally use partial decks.
function readPersistedState(): GameState | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? (JSON.parse(raw).state as GameState) : null
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('useGameStore', () => {
  it('starts with a fresh, valid playing game and no undo history', () => {
    const store = useGameStore()

    expect(store.state.status).toBe('playing')
    expect(store.state.score).toBe(0)
    expect(store.state.moveCount).toBe(0)
    expect(isCompleteUniqueDeck(allCards(store.state))).toBe(true)
    expect(store.canUndo).toBe(false)
    expect(store.isWon).toBe(false)
  })

  it('newGame(seed) is deterministic', () => {
    const store = useGameStore()
    store.newGame(42)
    const first = store.state

    store.newGame(42)
    const second = store.state

    expect(second).toEqual(first)
  })

  it('newGame resets undo history', () => {
    const store = useGameStore()
    store.clickStock()
    expect(store.canUndo).toBe(true)

    store.newGame(1)
    expect(store.canUndo).toBe(false)
  })

  it('clickStock draws a card and enables undo', () => {
    const store = useGameStore()
    const stockBefore = store.state.stock.length

    store.clickStock()

    expect(store.state.waste).toHaveLength(1)
    expect(store.state.stock).toHaveLength(stockBefore - 1)
    expect(store.canUndo).toBe(true)
  })

  it('clickStock is a no-op when stock and waste are both empty', () => {
    const store = useGameStore()
    store.state = emptyState()
    const before = store.state

    store.clickStock()

    expect(store.state).toBe(before)
    expect(store.canUndo).toBe(false)
  })

  it('move rejects an illegal command without touching undo history', () => {
    const store = useGameStore()
    const before = store.state

    const command: MoveCommand = { from: { type: 'waste' }, to: { type: 'tableau', column: 0 } }
    store.move(command)

    expect(store.state).toBe(before)
    expect(store.canUndo).toBe(false)
  })

  it('move applies a legal command and enables undo', () => {
    const store = useGameStore()
    store.state = emptyState({ waste: [createCard('spades', 13, true)] })

    const command: MoveCommand = { from: { type: 'waste' }, to: { type: 'tableau', column: 0 } }
    store.move(command)

    expect(store.state.tableau[0]).toEqual([createCard('spades', 13, true)])
    expect(store.state.waste).toEqual([])
    expect(store.canUndo).toBe(true)
  })

  it('undo restores the exact prior state and clears when exhausted', () => {
    const store = useGameStore()
    store.state = emptyState({ waste: [createCard('spades', 13, true)] })
    const original = store.state

    store.move({ from: { type: 'waste' }, to: { type: 'tableau', column: 0 } })
    expect(store.state).not.toBe(original)

    store.undo()

    expect(store.state).toEqual(original)
    expect(store.canUndo).toBe(false)
  })

  it('undo unwinds multiple moves in LIFO order', () => {
    const store = useGameStore()
    store.state = emptyState({
      stock: [createCard('clubs', 1, false), createCard('clubs', 2, false)],
    })
    const original = store.state

    store.clickStock()
    store.clickStock()
    expect(store.state.waste).toHaveLength(2)

    store.undo()
    store.undo()

    expect(store.state).toEqual(original)
  })

  it('undo is a no-op once history is exhausted', () => {
    const store = useGameStore()
    const before = store.state

    store.undo()

    expect(store.state).toBe(before)
  })

  it('caps undo history at MAX_UNDO_HISTORY entries', () => {
    const store = useGameStore()

    for (let i = 0; i < 101; i++) {
      store.clickStock()
    }

    let undoCount = 0
    while (store.canUndo) {
      store.undo()
      undoCount++
    }

    expect(undoCount).toBe(100)
  })

  it('restores a previously saved game on creation instead of starting fresh', () => {
    const saved = createInitialGameState(777)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: saved, savedAt: 0 }))

    const store = useGameStore()

    expect(store.state).toEqual(saved)
  })

  it('starts a fresh game when there is nothing valid to restore', () => {
    const store = useGameStore()
    expect(isCompleteUniqueDeck(allCards(store.state))).toBe(true)
  })

  it('persists to localStorage after a successful move', () => {
    const store = useGameStore()
    store.state = emptyState({ waste: [createCard('spades', 13, true)] })

    store.move({ from: { type: 'waste' }, to: { type: 'tableau', column: 0 } })

    expect(readPersistedState()).toEqual(store.state)
  })

  it('persists a fresh newGame, overwriting any previous save', () => {
    const store = useGameStore()
    store.newGame(555)

    expect(loadGame()).toEqual(store.state)
  })

  it('persists the restored state after an undo', () => {
    const store = useGameStore()
    store.state = emptyState({ waste: [createCard('spades', 13, true)] })
    const original = store.state

    store.move({ from: { type: 'waste' }, to: { type: 'tableau', column: 0 } })
    store.undo()

    expect(readPersistedState()).toEqual(original)
  })

  it('does not persist a rejected, no-op action', () => {
    const store = useGameStore()
    store.newGame(1)
    const savedAfterNewGame = loadGame()

    store.move({ from: { type: 'waste' }, to: { type: 'tableau', column: 0 } })

    expect(loadGame()).toEqual(savedAfterNewGame)
  })
})
