// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CARD_MOVE_ANIMATION_MS } from '../animationTiming'
import { createCard, RANKS } from '../domain/cards'
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
  vi.useFakeTimers()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
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

  describe('timer and pause', () => {
    it('increments elapsedSeconds once per second once a move has been made', () => {
      const store = useGameStore()
      store.state = emptyState({ stock: [createCard('clubs', 1, false)] })
      store.clickStock()

      vi.advanceTimersByTime(3000)

      expect(store.state.elapsedSeconds).toBe(3)
    })

    it('does not start ticking until the first card actually moves', () => {
      const store = useGameStore()
      store.state = emptyState({ stock: [createCard('clubs', 1, false)] })
      expect(store.state.moveCount).toBe(0)

      vi.advanceTimersByTime(5000)
      expect(store.state.elapsedSeconds).toBe(0)

      store.clickStock()
      expect(store.state.moveCount).toBe(1)

      vi.advanceTimersByTime(2000)
      expect(store.state.elapsedSeconds).toBe(2)
    })

    it('pause stops the timer, sets status, and does not touch undo history', () => {
      const store = useGameStore()
      store.state = emptyState({ waste: [createCard('spades', 13, true)] })
      store.move({ from: { type: 'waste' }, to: { type: 'tableau', column: 0 } })
      expect(store.canUndo).toBe(true)

      store.pause()
      const elapsedAtPause = store.state.elapsedSeconds

      expect(store.state.status).toBe('paused')
      expect(store.canUndo).toBe(false)

      vi.advanceTimersByTime(5000)

      expect(store.state.elapsedSeconds).toBe(elapsedAtPause)
    })

    it('resume restarts the timer and restores playing status', () => {
      const store = useGameStore()
      store.state = emptyState({ moveCount: 1 })
      store.pause()

      store.resume()
      expect(store.state.status).toBe('playing')

      vi.advanceTimersByTime(2000)
      expect(store.state.elapsedSeconds).toBe(2)
    })

    it('pause is a no-op when not playing, resume is a no-op when not paused', () => {
      const store = useGameStore()
      store.state = emptyState()

      store.resume()
      expect(store.state.status).toBe('playing')

      store.pause()
      const paused = store.state
      store.pause()
      expect(store.state).toBe(paused)
    })

    it('stops the timer once the game is won', () => {
      const store = useGameStore()

      // Win by completing the last foundation (hearts) via a real move.
      store.state = emptyState({
        foundations: {
          clubs: RANKS.map((rank) => createCard('clubs', rank, true)),
          diamonds: RANKS.map((rank) => createCard('diamonds', rank, true)),
          spades: RANKS.map((rank) => createCard('spades', rank, true)),
          hearts: RANKS.slice(0, 12).map((rank) => createCard('hearts', rank, true)),
        },
        tableau: [[createCard('hearts', 13, true)], [], [], [], [], [], []],
      })

      store.move({ from: { type: 'tableau', column: 0, cardIndex: 0 }, to: { type: 'foundation', suit: 'hearts' } })

      expect(store.isWon).toBe(true)
      const elapsedAtWin = store.state.elapsedSeconds

      vi.advanceTimersByTime(5000)

      expect(store.state.elapsedSeconds).toBe(elapsedAtWin)
    })

    it('persists periodically rather than on every tick', () => {
      const store = useGameStore()
      store.state = emptyState({ stock: [createCard('clubs', 1, false)] })
      store.clickStock()

      vi.advanceTimersByTime(9000)
      expect(readPersistedState()?.elapsedSeconds ?? 0).toBe(0)

      vi.advanceTimersByTime(1000)
      expect(readPersistedState()?.elapsedSeconds).toBe(10)
    })
  })

  describe('autoComplete', () => {
    const descendingRanks = [...RANKS].reverse()

    it('is unavailable while the stock has cards or any tableau card is face down', () => {
      const store = useGameStore()
      store.state = emptyState({ stock: [createCard('clubs', 1, false)] })
      expect(store.canAutoComplete).toBe(false)

      store.state = emptyState({
        tableau: [[createCard('clubs', 5, false)], [], [], [], [], [], []],
      })
      expect(store.canAutoComplete).toBe(false)
    })

    it('cascades every card to its foundation as a single undo step', () => {
      const store = useGameStore()
      store.state = emptyState({
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
      const original = store.state
      expect(store.canAutoComplete).toBe(true)

      store.autoComplete()

      expect(store.isWon).toBe(true)
      expect(store.state.foundations.hearts).toHaveLength(13)

      store.undo()

      expect(store.state).toEqual(original)
      expect(store.canUndo).toBe(false)
    })

    it('is a no-op when unavailable', () => {
      const store = useGameStore()
      store.state = emptyState({ stock: [createCard('clubs', 1, false)] })
      const before = store.state

      store.autoComplete()

      expect(store.state).toBe(before)
      expect(store.canUndo).toBe(false)
    })
  })

  describe('isAnimating (UI-facing move-animation lock)', () => {
    it('turns on after a successful move and off once the animation duration elapses', () => {
      const store = useGameStore()
      store.state = emptyState({ waste: [createCard('spades', 13, true)] })
      expect(store.isAnimating).toBe(false)

      store.move({ from: { type: 'waste' }, to: { type: 'tableau', column: 0 } })

      expect(store.isAnimating).toBe(true)
      vi.advanceTimersByTime(CARD_MOVE_ANIMATION_MS - 1)
      expect(store.isAnimating).toBe(true)
      vi.advanceTimersByTime(1)
      expect(store.isAnimating).toBe(false)
    })

    it('does not turn on for a rejected, no-op move', () => {
      const store = useGameStore()
      const command: MoveCommand = { from: { type: 'waste' }, to: { type: 'tableau', column: 0 } }

      store.move(command)

      expect(store.isAnimating).toBe(false)
    })

    it('turns on after clickStock and after undo as well', () => {
      const store = useGameStore()
      store.state = emptyState({ stock: [createCard('clubs', 1, false)] })

      store.clickStock()
      expect(store.isAnimating).toBe(true)
      vi.advanceTimersByTime(CARD_MOVE_ANIMATION_MS)
      expect(store.isAnimating).toBe(false)

      store.undo()
      expect(store.isAnimating).toBe(true)
      vi.advanceTimersByTime(CARD_MOVE_ANIMATION_MS)
      expect(store.isAnimating).toBe(false)
    })

    it('is reset immediately by newGame even mid-animation', () => {
      const store = useGameStore()
      store.state = emptyState({ waste: [createCard('spades', 13, true)] })
      store.move({ from: { type: 'waste' }, to: { type: 'tableau', column: 0 } })
      expect(store.isAnimating).toBe(true)

      store.newGame(1)

      expect(store.isAnimating).toBe(false)

      // The old timeout must not fire later and flip it back on/off unexpectedly.
      vi.advanceTimersByTime(CARD_MOVE_ANIMATION_MS)
      expect(store.isAnimating).toBe(false)
    })

    it('does not gate the store actions themselves — they remain callable at any time', () => {
      const store = useGameStore()
      store.state = emptyState({
        stock: [createCard('clubs', 1, false), createCard('clubs', 2, false)],
      })

      // Two real actions back-to-back with no time advanced between them:
      // the store's own API is not the thing enforcing the lock.
      store.clickStock()
      store.clickStock()

      expect(store.state.waste).toHaveLength(2)
    })
  })
})
