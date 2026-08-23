import { defineStore } from 'pinia'
import { computed, onScopeDispose, shallowRef } from 'vue'
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
    const shouldRun = state.value.status === 'playing'
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
    return true
  }

  function newGame(seed: ShuffleSeed = generateSeed()) {
    state.value = createInitialGameState(seed)
    history.value = []
    persist()
    syncTimer()
  }

  function clickStock() {
    applyIfChanged(clickStockMove(state.value))
  }

  function move(command: MoveCommand): boolean {
    return applyIfChanged(applyMove(state.value, command))
  }

  function undo() {
    if (history.value.length === 0) return
    const remaining = [...history.value]
    const restored = remaining.pop()!
    history.value = remaining
    state.value = restored
    persist()
    syncTimer()
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
  })

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persist()
    })
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', persist)
  }

  return { state, canUndo, isWon, isPlayable, newGame, clickStock, move, undo, pause, resume }
})
