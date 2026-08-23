import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import { createInitialGameState, type GameState } from '../domain/deal'
import { applyMove, clickStock as clickStockMove, type MoveCommand } from '../domain/moves'
import type { ShuffleSeed } from '../domain/shuffle'
import { loadGame, saveGame } from '../persistence/gameStorage'

export const MAX_UNDO_HISTORY = 100

function generateSeed(): ShuffleSeed {
  return Math.floor(Math.random() * 0x100000000)
}

export const useGameStore = defineStore('game', () => {
  const state = shallowRef<GameState>(loadGame() ?? createInitialGameState(generateSeed()))
  const history = shallowRef<GameState[]>([])

  const canUndo = computed(() => history.value.length > 0)
  const isWon = computed(() => state.value.status === 'won')

  function persist() {
    saveGame(state.value)
  }

  function pushHistory(snapshot: GameState) {
    const next = [...history.value, snapshot]
    history.value =
      next.length > MAX_UNDO_HISTORY ? next.slice(next.length - MAX_UNDO_HISTORY) : next
  }

  function applyIfChanged(next: GameState) {
    const previous = state.value
    if (next === previous) return
    pushHistory(previous)
    state.value = next
    persist()
  }

  function newGame(seed: ShuffleSeed = generateSeed()) {
    state.value = createInitialGameState(seed)
    history.value = []
    persist()
  }

  function clickStock() {
    applyIfChanged(clickStockMove(state.value))
  }

  function move(command: MoveCommand) {
    applyIfChanged(applyMove(state.value, command))
  }

  function undo() {
    if (history.value.length === 0) return
    const remaining = [...history.value]
    const restored = remaining.pop()!
    history.value = remaining
    state.value = restored
    persist()
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persist()
    })
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', persist)
  }

  return { state, canUndo, isWon, newGame, clickStock, move, undo }
})
