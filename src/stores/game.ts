import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import { createInitialGameState, type GameState } from '../domain/deal'
import { applyMove, clickStock as clickStockMove, type MoveCommand } from '../domain/moves'
import type { ShuffleSeed } from '../domain/shuffle'

export const MAX_UNDO_HISTORY = 100

function generateSeed(): ShuffleSeed {
  return Math.floor(Math.random() * 0x100000000)
}

export const useGameStore = defineStore('game', () => {
  const state = shallowRef<GameState>(createInitialGameState(generateSeed()))
  const history = shallowRef<GameState[]>([])

  const canUndo = computed(() => history.value.length > 0)
  const isWon = computed(() => state.value.status === 'won')

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
  }

  function newGame(seed: ShuffleSeed = generateSeed()) {
    state.value = createInitialGameState(seed)
    history.value = []
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
  }

  return { state, canUndo, isWon, newGame, clickStock, move, undo }
})
