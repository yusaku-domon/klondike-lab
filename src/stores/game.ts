import { defineStore } from 'pinia'
import { computed, onScopeDispose, shallowRef } from 'vue'
import { CARD_MOVE_ANIMATION_MS } from '../animationTiming'
import { autoCompleteSteps, canAutoComplete as canAutoCompleteState } from '../domain/autoComplete'
import { createInitialGameState, type GameState } from '../domain/deal'
import { applyMove, clickStock as clickStockMove, type MoveCommand } from '../domain/moves'
import type { ShuffleSeed } from '../domain/shuffle'
import { loadGame, saveGame } from '../persistence/gameStorage'

export const MAX_UNDO_HISTORY = 100
const ELAPSED_SECONDS_SAVE_INTERVAL_TICKS = 10

function generateSeed(): ShuffleSeed {
  return Math.floor(Math.random() * 0x100000000)
}

export const useGameStore = defineStore('game', () => {
  const state = shallowRef<GameState>(loadGame() ?? createInitialGameState(generateSeed()))
  const history = shallowRef<GameState[]>([])

  // Bumped only by newGame(), never by a move/undo. UI layers (GameBoard)
  // watch this to clear any pile selection they're holding locally — a
  // fresh deal reuses the same pile shapes (e.g. tableau column 6 always
  // ends at cardIndex 6), so a leftover selection can otherwise keep
  // resolving to a real-looking card in the new game instead of nothing.
  const gameEpoch = shallowRef(0)

  const canUndo = computed(() => history.value.length > 0 && state.value.status === 'playing')
  const isWon = computed(() => state.value.status === 'won')
  const isPlayable = computed(() => state.value.status === 'playing')
  const canAutoComplete = computed(() => canAutoCompleteState(state.value))

  // UI-facing signal only: the click layer (GameBoard/GameToolbar) uses
  // this to ignore new input while a move's animation is still playing, so
  // a rapid second click can't start a new transition before the first
  // settles. The store's own actions never gate on this — they remain
  // callable at any time (e.g. from tests) exactly as before.
  const isAnimatingRef = shallowRef(false)
  const isAnimating = computed(() => isAnimatingRef.value)
  let animationTimer: ReturnType<typeof setTimeout> | null = null

  function clearAnimationLock() {
    if (animationTimer !== null) {
      clearTimeout(animationTimer)
      animationTimer = null
    }
    isAnimatingRef.value = false
  }

  function triggerMoveAnimation() {
    isAnimatingRef.value = true
    if (animationTimer !== null) clearTimeout(animationTimer)
    animationTimer = setTimeout(() => {
      animationTimer = null
      isAnimatingRef.value = false
    }, CARD_MOVE_ANIMATION_MS)
  }

  function persist() {
    saveGame(state.value)
  }

  function pushHistory(snapshot: GameState) {
    const next = [...history.value, snapshot]
    history.value =
      next.length > MAX_UNDO_HISTORY ? next.slice(next.length - MAX_UNDO_HISTORY) : next
  }

  // Ticks on a 1s interval rather than diffing against a stored start time,
  // so time spent backgrounded/throttled is never silently added back in
  // (spec section 5). Only runs while status is 'playing'.
  let timerHandle: ReturnType<typeof setInterval> | null = null
  let ticksSinceSave = 0

  function tick() {
    state.value = { ...state.value, elapsedSeconds: state.value.elapsedSeconds + 1 }
    ticksSinceSave += 1
    if (ticksSinceSave >= ELAPSED_SECONDS_SAVE_INTERVAL_TICKS) {
      ticksSinceSave = 0
      persist()
    }
  }

  function syncTimer() {
    // Don't start counting while the player is just looking at a freshly
    // dealt board — the clock begins the moment the first card actually
    // moves (a draw or a move both increment moveCount).
    const shouldRun = state.value.status === 'playing' && state.value.moveCount > 0
    if (shouldRun && timerHandle === null) {
      timerHandle = setInterval(tick, 1000)
    } else if (!shouldRun && timerHandle !== null) {
      clearInterval(timerHandle)
      timerHandle = null
      ticksSinceSave = 0
    }
  }

  function applyIfChanged(next: GameState): boolean {
    const previous = state.value
    if (next === previous) return false
    pushHistory(previous)
    state.value = next
    persist()
    syncTimer()
    triggerMoveAnimation()
    return true
  }

  function newGame(seed: ShuffleSeed = generateSeed()) {
    state.value = createInitialGameState(seed)
    history.value = []
    persist()
    syncTimer()
    // A fresh deal replaces every card position outright; any lock from a
    // move in the previous game is meaningless now.
    clearAnimationLock()
    gameEpoch.value += 1
  }

  function clickStock() {
    applyIfChanged(clickStockMove(state.value))
  }

  function move(command: MoveCommand): boolean {
    return applyIfChanged(applyMove(state.value, command))
  }

  // Plays the cascade back one atomic move at a time (each foundation move
  // or stock click gets its own state update, CARD_MOVE_ANIMATION_MS apart)
  // instead of jumping straight to the final state — so GameBoard's
  // existing per-move animation watcher, which only ever sees one state
  // transition at a time, animates each card individually exactly as it
  // would for a manual move. Still counts as a SINGLE undo step and a
  // single persisted save, matching the pre-existing external contract:
  // history/persist only happen once, after every step has landed.
  async function autoComplete() {
    // isAnimating also rejects a re-entrant call: it's set true below
    // before this function's first `await`, so a second call arriving
    // synchronously right after (bypassing the UI's own isAnimating-gated
    // click handlers) still can't slip in — canAutoComplete alone would
    // stay true throughout the cascade and wouldn't catch this.
    if (!canAutoComplete.value || isAnimatingRef.value) return

    const steps = autoCompleteSteps(state.value)
    if (steps.length === 0) return

    const previous = state.value
    const startEpoch = gameEpoch.value

    // Holds the input lock for the whole cascade, not just one move's
    // worth — a manual click or a second auto-complete trigger must stay
    // blocked until the last card has actually landed.
    if (animationTimer !== null) {
      clearTimeout(animationTimer)
      animationTimer = null
    }
    isAnimatingRef.value = true

    for (const step of steps) {
      // A new game started mid-cascade (gameEpoch only changes there):
      // newGame() already reset state/history/persist and cleared the
      // animation lock itself, so stop immediately without touching any
      // of it again — applying a stale step now would resurrect cards
      // from the abandoned game into the fresh deal.
      if (gameEpoch.value !== startEpoch) return
      state.value = step
      await new Promise<void>((resolve) => setTimeout(resolve, CARD_MOVE_ANIMATION_MS))
    }

    if (gameEpoch.value !== startEpoch) return

    pushHistory(previous)
    persist()
    syncTimer()
    isAnimatingRef.value = false
  }

  function undo() {
    if (history.value.length === 0) return
    const remaining = [...history.value]
    const restored = remaining.pop()!
    history.value = remaining
    state.value = restored
    persist()
    syncTimer()
    triggerMoveAnimation()
  }

  function pause() {
    if (state.value.status !== 'playing') return
    state.value = { ...state.value, status: 'paused' }
    persist()
    syncTimer()
  }

  function resume() {
    if (state.value.status !== 'paused') return
    state.value = { ...state.value, status: 'playing' }
    persist()
    syncTimer()
  }

  syncTimer()
  onScopeDispose(() => {
    if (timerHandle !== null) clearInterval(timerHandle)
    if (animationTimer !== null) clearTimeout(animationTimer)
  })

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persist()
    })
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', persist)
  }

  return {
    state,
    canUndo,
    isWon,
    isPlayable,
    canAutoComplete,
    isAnimating,
    gameEpoch,
    newGame,
    clickStock,
    move,
    undo,
    pause,
    resume,
    autoComplete,
  }
})
