import { defineStore } from 'pinia'
import { computed, onScopeDispose, shallowRef } from 'vue'
import { CARD_MOVE_ANIMATION_MS } from '../animationTiming'
import { autoCompleteAll, canAutoComplete as canAutoCompleteState } from '../domain/autoComplete'
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
  }

  function clickStock() {
    applyIfChanged(clickStockMove(state.value))
  }

  function move(command: MoveCommand): boolean {
    return applyIfChanged(applyMove(state.value, command))
  }

  function autoComplete() {
    if (!canAutoComplete.value) return
    applyIfChanged(autoCompleteAll(state.value))
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
    newGame,
    clickStock,
    move,
    undo,
    pause,
    resume,
    autoComplete,
  }
})
