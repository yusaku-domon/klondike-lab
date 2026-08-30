// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS, CARD_MOVE_ANIMATION_MS } from '../animationTiming'
import { emptyState } from '../testFixtures'
import { createCard, RANKS } from '../domain/cards'
import { createInitialGameState, type GameState } from '../domain/deal'
import { isCompleteUniqueDeck } from '../domain/invariants'
import type { MoveCommand } from '../domain/moves'
import { loadGame, STORAGE_KEY } from '../persistence/gameStorage'
import { useGameStore } from './game'

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

  describe('seed history recording', () => {
    it('records a loss for an unfinished game when a new one starts', () => {
      const store = useGameStore()
      store.state = emptyState({ seed: 111, moveCount: 5, status: 'playing' })

      store.newGame(222)

      expect(store.seedHistory).toEqual([{ seed: 111, result: 'lose' }])
    })

    it('records a loss for a paused game too', () => {
      const store = useGameStore()
      store.state = emptyState({ seed: 111, moveCount: 5, status: 'paused' })

      store.newGame(222)

      expect(store.seedHistory).toEqual([{ seed: 111, result: 'lose' }])
    })

    it('records a win for a game left in the won status', () => {
      const store = useGameStore()
      store.state = emptyState({ seed: 111, moveCount: 40, status: 'won' })

      store.newGame(222)

      expect(store.seedHistory).toEqual([{ seed: 111, result: 'win' }])
    })

    it('does not record anything for a game that was never touched', () => {
      const store = useGameStore()
      store.state = emptyState({ seed: 111, moveCount: 0, status: 'playing' })

      store.newGame(222)

      expect(store.seedHistory).toEqual([])
    })

    it('accumulates entries newest-first across multiple games', () => {
      const store = useGameStore()
      store.state = emptyState({ seed: 1, moveCount: 3, status: 'won' })

      store.newGame(2)
      store.state = emptyState({ seed: 2, moveCount: 3, status: 'playing' })
      store.newGame(3)

      expect(store.seedHistory).toEqual([
        { seed: 2, result: 'lose' },
        { seed: 1, result: 'win' },
      ])
    })
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

  describe('redo', () => {
    it('starts with no redo history', () => {
      const store = useGameStore()
      expect(store.canRedo).toBe(false)
    })

    it('replays a single undone card move exactly', () => {
      const store = useGameStore()
      store.state = emptyState({ waste: [createCard('spades', 13, true)] })

      store.move({ from: { type: 'waste' }, to: { type: 'tableau', column: 0 } })
      const afterMove = store.state

      store.undo()
      expect(store.canRedo).toBe(true)

      store.redo()

      expect(store.state).toEqual(afterMove)
      expect(store.canRedo).toBe(false)
      expect(store.canUndo).toBe(true)
    })

    it('replays an undone stock draw exactly', () => {
      const store = useGameStore()
      store.state = emptyState({ stock: [createCard('clubs', 1, false)] })

      store.clickStock()
      const afterDraw = store.state

      store.undo()
      store.redo()

      expect(store.state).toEqual(afterDraw)
    })

    it('replays an undone multi-card tableau move exactly', () => {
      const store = useGameStore()
      store.state = emptyState({
        tableau: [
          [createCard('hearts', 6, true), createCard('clubs', 5, true)],
          [createCard('spades', 7, true)],
          [],
          [],
          [],
          [],
          [],
        ],
      })

      store.move({ from: { type: 'tableau', column: 0, cardIndex: 0 }, to: { type: 'tableau', column: 1 } })
      const afterMove = store.state
      expect(afterMove.tableau[1]).toHaveLength(3)

      store.undo()
      store.redo()

      expect(store.state).toEqual(afterMove)
    })

    it('replays an undone stock recycle (waste back to stock) exactly', () => {
      const store = useGameStore()
      store.state = emptyState({ waste: [createCard('clubs', 1, true), createCard('clubs', 2, true)] })

      store.clickStock()
      const afterRecycle = store.state
      expect(afterRecycle.stock).toHaveLength(2)
      expect(afterRecycle.waste).toHaveLength(0)

      store.undo()
      store.redo()

      expect(store.state).toEqual(afterRecycle)
    })

    it('replays an undone tableau-flip (revealing the new top card) exactly', () => {
      const store = useGameStore()
      store.state = emptyState({
        tableau: [
          [createCard('clubs', 9, false), createCard('spades', 13, true)],
          [],
          [],
          [],
          [],
          [],
          [],
        ],
      })

      // Only an empty column accepts a King — moves it off column 0
      // entirely, exposing (and auto-flipping) clubs-9 underneath.
      store.move({ from: { type: 'tableau', column: 0, cardIndex: 1 }, to: { type: 'tableau', column: 1 } })
      const afterFlip = store.state
      expect(afterFlip.tableau[0]).toEqual([createCard('clubs', 9, true)])

      store.undo()
      store.redo()

      expect(store.state).toEqual(afterFlip)
    })

    it('replays an undone move to a foundation exactly', () => {
      const store = useGameStore()
      store.state = emptyState({ waste: [createCard('hearts', 1, true)] })

      store.move({ from: { type: 'waste' }, to: { type: 'foundation', suit: 'hearts' } })
      const afterMove = store.state
      expect(afterMove.foundations.hearts).toEqual([createCard('hearts', 1, true)])

      store.undo()
      store.redo()

      expect(store.state).toEqual(afterMove)
    })

    it('replays multiple undone moves in order across consecutive redos', () => {
      const store = useGameStore()
      store.state = emptyState({
        stock: [createCard('clubs', 1, false), createCard('clubs', 2, false), createCard('clubs', 3, false)],
      })

      store.clickStock()
      const afterFirst = store.state
      store.clickStock()
      const afterSecond = store.state
      store.clickStock()
      const afterThird = store.state

      store.undo()
      store.undo()
      store.undo()
      expect(store.canRedo).toBe(true)

      store.redo()
      expect(store.state).toEqual(afterFirst)
      store.redo()
      expect(store.state).toEqual(afterSecond)
      store.redo()
      expect(store.state).toEqual(afterThird)
      expect(store.canRedo).toBe(false)
    })

    it('allows undoing again after a redo', () => {
      const store = useGameStore()
      store.state = emptyState({ waste: [createCard('spades', 13, true)] })
      const original = store.state

      store.move({ from: { type: 'waste' }, to: { type: 'tableau', column: 0 } })
      const afterMove = store.state

      store.undo()
      store.redo()
      expect(store.state).toEqual(afterMove)

      store.undo()

      expect(store.state).toEqual(original)
    })

    it('discards all redo history once a new move is made after an undo', () => {
      const store = useGameStore()
      store.state = emptyState({
        stock: [createCard('clubs', 1, false), createCard('clubs', 2, false)],
      })

      store.clickStock()
      store.undo()
      expect(store.canRedo).toBe(true)

      // A genuinely new forward action, not a redo.
      store.clickStock()

      expect(store.canRedo).toBe(false)
    })

    it('discards all redo history once a new auto-complete cascade runs after an undo', async () => {
      const store = useGameStore()
      store.state = emptyState({
        foundations: { clubs: [createCard('clubs', 4, true)], diamonds: [], hearts: [], spades: [] },
        tableau: [[createCard('clubs', 5, true)], [], [], [], [], [], []],
      })

      store.move({ from: { type: 'tableau', column: 0, cardIndex: 0 }, to: { type: 'foundation', suit: 'clubs' } })
      store.undo()
      // Clears undo()'s own animation lock so autoComplete's isAnimating
      // guard doesn't reject it as a no-op immediately below.
      vi.advanceTimersByTime(CARD_MOVE_ANIMATION_MS)
      expect(store.canRedo).toBe(true)
      expect(store.canAutoComplete).toBe(true)

      const done = store.autoComplete()
      await vi.advanceTimersByTimeAsync(AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await done

      expect(store.canRedo).toBe(false)
    })

    it('does not discard redo history across pause/resume', () => {
      const store = useGameStore()
      store.state = emptyState({ waste: [createCard('spades', 13, true)] })

      store.move({ from: { type: 'waste' }, to: { type: 'tableau', column: 0 } })
      store.undo()
      expect(store.canRedo).toBe(true)

      store.pause()
      store.resume()

      expect(store.canRedo).toBe(true)
    })

    it('clears both undo and redo history on newGame', () => {
      const store = useGameStore()
      store.state = emptyState({ waste: [createCard('spades', 13, true)] })

      store.move({ from: { type: 'waste' }, to: { type: 'tableau', column: 0 } })
      store.undo()
      expect(store.canUndo).toBe(false)
      expect(store.canRedo).toBe(true)

      store.newGame(1)

      expect(store.canUndo).toBe(false)
      expect(store.canRedo).toBe(false)
    })

    it('redo is a no-op once redo history is exhausted', () => {
      const store = useGameStore()
      const before = store.state

      store.redo()

      expect(store.state).toBe(before)
    })

    it('is unavailable while paused, even with redo history present', () => {
      const store = useGameStore()
      store.state = emptyState({ waste: [createCard('spades', 13, true)] })

      store.move({ from: { type: 'waste' }, to: { type: 'tableau', column: 0 } })
      store.undo()
      expect(store.canRedo).toBe(true)

      store.pause()

      expect(store.canRedo).toBe(false)
    })

    it('does not double-count score or moveCount across an undo/redo round trip', () => {
      const store = useGameStore()
      store.state = emptyState({ waste: [createCard('hearts', 1, true)] })

      store.move({ from: { type: 'waste' }, to: { type: 'foundation', suit: 'hearts' } })
      const scoreAfterMove = store.state.score
      const movesAfterMove = store.state.moveCount

      store.undo()
      store.redo()

      expect(store.state.score).toBe(scoreAfterMove)
      expect(store.state.moveCount).toBe(movesAfterMove)
    })

    it('persists the redone state, and does not persist undo/redo history itself', () => {
      const store = useGameStore()
      store.state = emptyState({ waste: [createCard('spades', 13, true)] })

      store.move({ from: { type: 'waste' }, to: { type: 'tableau', column: 0 } })
      const afterMove = store.state
      store.undo()
      store.redo()

      expect(readPersistedState()).toEqual(afterMove)
    })

    it('reload (a fresh store instance) always starts with empty undo and redo history', () => {
      const first = useGameStore()
      first.state = emptyState({ waste: [createCard('spades', 13, true)] })
      first.move({ from: { type: 'waste' }, to: { type: 'tableau', column: 0 } })
      first.undo()
      expect(first.canRedo).toBe(true)

      // Simulates a reload: a brand-new store instance loading from
      // whatever was persisted, same as restoring a saved game elsewhere
      // in this file.
      setActivePinia(createPinia())
      const second = useGameStore()

      expect(second.canUndo).toBe(false)
      expect(second.canRedo).toBe(false)
    })

    it('does not register redo() itself as a new undoable action', () => {
      const store = useGameStore()
      store.state = emptyState({ waste: [createCard('spades', 13, true)] })
      const original = store.state

      store.move({ from: { type: 'waste' }, to: { type: 'tableau', column: 0 } })
      store.undo()
      store.redo()

      // One undo step to get back to `original` — not two, which would
      // happen if redo() had pushed an extra, spurious history entry on
      // top of the one it legitimately pushes to make itself undoable.
      store.undo()
      expect(store.state).toEqual(original)
      expect(store.canUndo).toBe(false)
    })
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

    it('freezes the elapsed-time clock for the whole auto-complete cascade, then resumes afterward', async () => {
      const store = useGameStore()
      store.state = emptyState({
        foundations: {
          clubs: [createCard('clubs', 4, true)],
          diamonds: [createCard('diamonds', 2, true)],
          hearts: [],
          spades: [createCard('spades', 6, true)],
        },
        tableau: [
          [createCard('clubs', 5, true)],
          [createCard('diamonds', 3, true)],
          [createCard('hearts', 1, true)],
          [createCard('spades', 7, true)],
          [],
          [],
          [],
        ],
        moveCount: 1,
      })
      // Directly assigning store.state (as opposed to going through a real
      // action) bypasses syncTimer()'s re-evaluation — pause/resume forces
      // it to notice moveCount is already > 0 and actually start ticking.
      store.pause()
      store.resume()
      // Get the clock ticking with a nonzero baseline before the cascade.
      vi.advanceTimersByTime(3000)
      const elapsedBefore = store.state.elapsedSeconds
      expect(elapsedBefore).toBe(3)

      const done = store.autoComplete()
      // 4 steps at the cascade's own (faster) pace — comfortably past a
      // real 1-second tick boundary, so if the clock weren't actually
      // stopped it would have ticked at least once during this window.
      await vi.advanceTimersByTimeAsync(4 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await done

      // Scoring is untouched by the timer change: all 4 moves still score
      // normally (tableau → foundation, +10 each) even while the clock is
      // frozen.
      expect(store.state.score).toBe(40)
      expect(store.state.elapsedSeconds).toBe(elapsedBefore)

      // Resumes ticking at the normal pace afterward, with no catch-up for
      // the frozen duration.
      vi.advanceTimersByTime(2000)
      expect(store.state.elapsedSeconds).toBe(elapsedBefore + 2)
    })

    it('keeps the elapsed-time clock stopped for good if the cascade wins the game', async () => {
      const descendingRanks = [...RANKS].reverse()
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
        moveCount: 1,
      })
      store.pause()
      store.resume()
      vi.advanceTimersByTime(5000)
      const elapsedBefore = store.state.elapsedSeconds
      expect(elapsedBefore).toBe(5)

      const done = store.autoComplete()
      await vi.advanceTimersByTimeAsync(52 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await done

      expect(store.isWon).toBe(true)
      expect(store.state.elapsedSeconds).toBe(elapsedBefore)

      // Stays stopped after a win, same as a manual winning move already does.
      vi.advanceTimersByTime(5000)
      expect(store.state.elapsedSeconds).toBe(elapsedBefore)
    })

    it('does not resume the elapsed-time clock if the player pauses and resumes mid-cascade', async () => {
      const store = useGameStore()
      store.state = emptyState({
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
        moveCount: 1,
      })
      store.pause()
      store.resume()
      vi.advanceTimersByTime(3000)
      const elapsedBefore = store.state.elapsedSeconds
      expect(elapsedBefore).toBe(3)

      const done = store.autoComplete()
      await vi.advanceTimersByTimeAsync(1) // let step 1 (clubs-5) land

      // Pausing mid-cascade, then immediately resuming, must not let
      // resume()'s own syncTimer() call restart the clock while the
      // cascade still has steps left to play — only the cascade's own
      // final syncTimer() call, once it's genuinely finished, may do that.
      store.pause()
      await vi.advanceTimersByTimeAsync(2 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      store.resume()
      await vi.advanceTimersByTimeAsync(1)
      expect(store.state.elapsedSeconds).toBe(elapsedBefore)

      await vi.advanceTimersByTimeAsync(2 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await done

      expect(store.state.foundations.hearts).toEqual([createCard('hearts', 1, true)])
      expect(store.state.elapsedSeconds).toBe(elapsedBefore)

      // Resumes ticking at the normal pace now that the cascade is
      // genuinely done, with no catch-up for the paused duration.
      vi.advanceTimersByTime(2000)
      expect(store.state.elapsedSeconds).toBe(elapsedBefore + 2)
    })
  })

  describe('autoComplete', () => {
    const descendingRanks = [...RANKS].reverse()

    it('is unavailable while any tableau card is face down, but not because of the stock/waste', () => {
      const store = useGameStore()
      store.state = emptyState({
        tableau: [[createCard('clubs', 5, false)], [], [], [], [], [], []],
      })
      expect(store.canAutoComplete).toBe(false)

      store.state = emptyState({
        stock: [createCard('clubs', 1, false)],
        waste: [createCard('spades', 1, true)],
        tableau: [[createCard('clubs', 5, true)], [], [], [], [], [], []],
      })
      expect(store.canAutoComplete).toBe(true)
    })

    it('cascades every card to its foundation, one at a time, as a single undo step', async () => {
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

      const done = store.autoComplete()

      // Every card must move (all 52), so the cascade isn't finished yet —
      // and per the single-undo-step contract, nothing should be
      // persisted/undo-able until the very last step lands.
      expect(store.isAnimating).toBe(true)
      expect(store.isWon).toBe(false)
      expect(store.canUndo).toBe(false)

      await vi.advanceTimersByTimeAsync(52 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await done

      expect(store.isAnimating).toBe(false)
      expect(store.isWon).toBe(true)
      expect(store.state.foundations.hearts).toHaveLength(13)

      store.undo()

      expect(store.state).toEqual(original)
      expect(store.canUndo).toBe(false)
    })

    it('animates one card at a time, not the whole cascade at once', async () => {
      const store = useGameStore()
      store.state = emptyState({
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

      const done = store.autoComplete()
      await vi.advanceTimersByTimeAsync(1)

      // First tick: only clubs-5 has moved so far — hearts-1 is still
      // sitting in its original column, not already relocated.
      expect(store.state.foundations.clubs).toEqual([
        createCard('clubs', 4, true),
        createCard('clubs', 5, true),
      ])
      expect(store.state.tableau[1]).toEqual([createCard('hearts', 1, true)])

      await vi.advanceTimersByTimeAsync(2 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await done

      expect(store.state.foundations.hearts).toEqual([createCard('hearts', 1, true)])
      expect(store.state.tableau[1]).toEqual([])
    })

    it('flags isAutoCompleting only for the duration of the cascade', async () => {
      const store = useGameStore()
      store.state = emptyState({
        foundations: { clubs: [createCard('clubs', 4, true)], diamonds: [], hearts: [], spades: [] },
        tableau: [[createCard('clubs', 5, true)], [], [], [], [], [], []],
      })
      expect(store.isAutoCompleting).toBe(false)

      const done = store.autoComplete()
      await vi.advanceTimersByTimeAsync(1)
      expect(store.isAutoCompleting).toBe(true)

      await vi.advanceTimersByTimeAsync(AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await done

      expect(store.isAutoCompleting).toBe(false)
    })

    it('is a no-op when unavailable', async () => {
      const store = useGameStore()
      store.state = emptyState({
        tableau: [[createCard('clubs', 5, false)], [], [], [], [], [], []],
      })
      const before = store.state

      await store.autoComplete()

      expect(store.state).toBe(before)
      expect(store.canUndo).toBe(false)
    })

    it('ignores a second trigger while a cascade is already in progress', async () => {
      const store = useGameStore()
      store.state = emptyState({
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

      const first = store.autoComplete()
      const second = store.autoComplete() // re-entrant call: must be a no-op
      await vi.advanceTimersByTimeAsync(2 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await first
      await second

      expect(store.state.foundations.clubs).toEqual([
        createCard('clubs', 4, true),
        createCard('clubs', 5, true),
      ])
      expect(store.state.foundations.hearts).toEqual([createCard('hearts', 1, true)])
      // Exactly one undo step for the whole cascade — a re-entrant second
      // run would have pushed a second (empty) history entry.
      store.undo()
      expect(store.canUndo).toBe(false)
    })

    it('abandons the cascade if a new game starts mid-sequence, without resurrecting stale cards', async () => {
      const store = useGameStore()
      store.state = emptyState({
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

      const done = store.autoComplete()
      await vi.advanceTimersByTimeAsync(1) // let the first step land

      store.newGame(999)
      const freshState = store.state
      expect(freshState.seed).toBe(999)

      await vi.advanceTimersByTimeAsync(2 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await done

      // The abandoned cascade's remaining step (hearts-1) must never be
      // applied on top of the fresh deal.
      expect(store.state).toBe(freshState)
      expect(store.isAnimating).toBe(false)
      expect(store.isAutoCompleting).toBe(false)
    })

    it('holds a paused cascade still — the next already-scheduled step never lands while paused', async () => {
      const store = useGameStore()
      store.state = emptyState({
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

      const done = store.autoComplete()
      await vi.advanceTimersByTimeAsync(1) // let step 1 (clubs-5) land
      expect(store.state.foundations.clubs).toEqual([
        createCard('clubs', 4, true),
        createCard('clubs', 5, true),
      ])
      expect(store.state.tableau[1]).toEqual([createCard('hearts', 1, true)])

      store.pause()
      expect(store.state.status).toBe('paused')

      // Advance well past when step 2 would have landed if the pause
      // hadn't actually taken hold — it must still be exactly one card in.
      await vi.advanceTimersByTimeAsync(10 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      expect(store.state.status).toBe('paused')
      expect(store.state.tableau[1]).toEqual([createCard('hearts', 1, true)])
      expect(store.state.foundations.hearts).toEqual([])
      expect(store.isAnimating).toBe(true)

      // Clean up the still-pending cascade so it doesn't leak into later
      // tests/timers.
      store.resume()
      await vi.advanceTimersByTimeAsync(2 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await done
    })

    it('resumes a paused cascade from exactly where it left off, finishing normally as one undo step', async () => {
      const store = useGameStore()
      store.state = emptyState({
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
      const original = store.state

      const done = store.autoComplete()
      await vi.advanceTimersByTimeAsync(1) // let step 1 (clubs-5) land

      store.pause()
      await vi.advanceTimersByTimeAsync(5 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)

      store.resume()
      expect(store.state.status).toBe('playing')

      await vi.advanceTimersByTimeAsync(2 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await done

      expect(store.state.foundations.hearts).toEqual([createCard('hearts', 1, true)])
      expect(store.state.tableau[1]).toEqual([])
      expect(store.isAnimating).toBe(false)
      expect(store.isAutoCompleting).toBe(false)

      // Still exactly one undo step for the whole cascade, pause/resume
      // included.
      store.undo()
      expect(store.state).toEqual(original)
      expect(store.canUndo).toBe(false)
    })

    it('runs the full cascade through the store when the stock and waste both still hold cards', async () => {
      // Previously unreachable through the store: canAutoComplete used to
      // require an empty stock, so this path (a real draw happening mid
      // cascade) never ran through applyIfChanged's animation/undo/persist
      // wiring until the activation condition was relaxed to tableau-only.
      const store = useGameStore()
      store.state = emptyState({
        foundations: { spades: ([1, 2, 3] as const).map((r) => createCard('spades', r, true)), clubs: [], diamonds: [], hearts: [] },
        tableau: [[createCard('spades', 4, true)], [], [], [], [], [], []],
        waste: [createCard('spades', 6, true)],
        stock: [createCard('spades', 5, false)],
      })
      const original = store.state
      expect(store.canAutoComplete).toBe(true)

      const done = store.autoComplete()
      await vi.advanceTimersByTimeAsync(10 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await done

      expect(store.state.foundations.spades).toEqual(
        ([1, 2, 3, 4, 5, 6] as const).map((r) => createCard('spades', r, true)),
      )
      expect(store.state.stock).toEqual([])
      expect(store.state.waste).toEqual([])
      expect(store.isAnimating).toBe(false)

      // Still a single undo step for the whole cascade, unchanged by
      // having drawn from the stock partway through.
      store.undo()
      expect(store.state).toEqual(original)
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

  describe('lifecycle cleanup', () => {
    it('removes its visibilitychange/beforeunload listeners when disposed', () => {
      const docAddSpy = vi.spyOn(document, 'addEventListener')
      const docRemoveSpy = vi.spyOn(document, 'removeEventListener')
      const winAddSpy = vi.spyOn(window, 'addEventListener')
      const winRemoveSpy = vi.spyOn(window, 'removeEventListener')

      const store = useGameStore()

      const visibilityHandler = docAddSpy.mock.calls.find(
        (call) => call[0] === 'visibilitychange',
      )?.[1]
      const beforeUnloadHandler = winAddSpy.mock.calls.find(
        (call) => call[0] === 'beforeunload',
      )?.[1]
      expect(visibilityHandler).toBeTypeOf('function')
      expect(beforeUnloadHandler).toBeTypeOf('function')

      // Without cleanup, a re-instantiated store (dev HMR, another test)
      // would pile up another pair of listeners forever, each still
      // closing over this instance's now-abandoned state/persist.
      store.$dispose()

      expect(docRemoveSpy).toHaveBeenCalledWith('visibilitychange', visibilityHandler)
      expect(winRemoveSpy).toHaveBeenCalledWith('beforeunload', beforeUnloadHandler)
    })
  })
})
