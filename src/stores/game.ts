import { defineStore } from 'pinia'
import { computed, onScopeDispose, shallowRef } from 'vue'
import { AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS, CARD_MOVE_ANIMATION_MS } from '../animationTiming'
import { autoCompleteSteps, canAutoComplete as canAutoCompleteState } from '../domain/autoComplete'
import { createInitialGameState, type GameState } from '../domain/deal'
import { applyMove, clickStock as clickStockMove, type MoveCommand } from '../domain/moves'
import type { ShuffleSeed } from '../domain/shuffle'
import { loadGame, saveGame } from '../persistence/gameStorage'
import { loadSeedHistory, recordSeedResult, type SeedHistoryEntry } from '../persistence/seedHistoryStorage'

export const MAX_UNDO_HISTORY = 100
const ELAPSED_SECONDS_SAVE_INTERVAL_TICKS = 10

function generateSeed(): ShuffleSeed {
  return Math.floor(Math.random() * 0x100000000)
}

export const useGameStore = defineStore('game', () => {
  const state = shallowRef<GameState>(loadGame() ?? createInitialGameState(generateSeed()))
  const history = shallowRef<GameState[]>([])
  const seedHistory = shallowRef<SeedHistoryEntry[]>(loadSeedHistory())

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
  // UI-facing signal only, same as isAnimating above: lets the board pick
  // the faster cascade transition duration for the cards it's currently
  // drawing, without the store's own pacing/logic depending on it at all.
  const isAutoCompletingRef = shallowRef(false)
  const isAutoCompleting = computed(() => isAutoCompletingRef.value)
  let animationTimer: ReturnType<typeof setTimeout> | null = null

  // Lets a paused auto-complete cascade actually hold still instead of the
  // next already-scheduled step silently overwriting the pause: the
  // cascade loop below awaits this while status is 'paused', and resume()
  // (or an abandoning newGame(), via clearAnimationLock) wakes it back up.
  let resumeWaiters: Array<() => void> = []

  function waitForResume(): Promise<void> {
    return new Promise((resolve) => {
      resumeWaiters.push(resolve)
    })
  }

  function releaseResumeWaiters() {
    const waiters = resumeWaiters
    resumeWaiters = []
    for (const resolve of waiters) resolve()
  }

  function clearAnimationLock() {
    if (animationTimer !== null) {
      clearTimeout(animationTimer)
      animationTimer = null
    }
    isAnimatingRef.value = false
    isAutoCompletingRef.value = false
    releaseResumeWaiters()
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

  function stopTimer() {
    if (timerHandle !== null) {
      clearInterval(timerHandle)
      timerHandle = null
      ticksSinceSave = 0
    }
  }

  function syncTimer() {
    // Don't start counting while the player is just looking at a freshly
    // dealt board — the clock begins the moment the first card actually
    // moves (a draw or a move both increment moveCount). Also never while
    // an auto-complete cascade is in flight (including while it's paused
    // partway through) — resume() calls this too, and without the extra
    // check it would restart the clock for whatever's left of the
    // cascade, undoing the "cascade time never counts" guarantee.
    const shouldRun =
      state.value.status === 'playing' && state.value.moveCount > 0 && !isAutoCompletingRef.value
    if (shouldRun && timerHandle === null) {
      timerHandle = setInterval(tick, 1000)
    } else if (!shouldRun) {
      stopTimer()
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
    // Only a game the player actually touched counts as a result worth
    // recording — a reroll before making a single move isn't a loss, it's
    // just picking a different deal. Reaching 'won' is the only way to
    // win; anything else (still playing, or paused) at the moment the
    // player moves on counts as a loss.
    if (state.value.moveCount > 0) {
      seedHistory.value = recordSeedResult(state.value.seed, state.value.status === 'won' ? 'win' : 'lose')
    }
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
  // or stock click gets its own state update, AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS
  // apart) instead of jumping straight to the final state — so GameBoard's
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
    isAutoCompletingRef.value = true

    // The cascade's own pacing (AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS per
    // step) is purely a display mechanism, not something the player spent
    // time deciding — stop the elapsed-time clock for its duration so it
    // doesn't count toward play time. No catch-up afterward: the skipped
    // seconds are simply never counted, and syncTimer() below resumes the
    // normal one-tick-per-real-second pace once the cascade lands.
    stopTimer()

    for (const step of steps) {
      // A new game started mid-cascade (gameEpoch only changes there):
      // newGame() already reset state/history/persist and cleared the
      // animation lock itself, so stop immediately without touching any
      // of it again — applying a stale step now would resurrect cards
      // from the abandoned game into the fresh deal.
      if (gameEpoch.value !== startEpoch) return

      // Honor a pause requested mid-cascade: hold here, without applying
      // the next step, until the player resumes — otherwise the next
      // already-scheduled step would silently overwrite pause()'s
      // 'paused' status a moment later and the cascade would run to
      // completion regardless of the player's request. A `while` (not
      // `if`) covers a rapid re-pause landing right as this wakes up.
      while (state.value.status === 'paused') {
        await waitForResume()
        if (gameEpoch.value !== startEpoch) return
      }

      state.value = step
      await new Promise<void>((resolve) => setTimeout(resolve, AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS))
    }

    if (gameEpoch.value !== startEpoch) return

    pushHistory(previous)
    persist()
    // Cleared before syncTimer() so it can actually restart the clock now
    // that the cascade is genuinely finished (syncTimer() itself refuses
    // to run while isAutoCompletingRef is still true).
    isAnimatingRef.value = false
    isAutoCompletingRef.value = false
    syncTimer()
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
    releaseResumeWaiters()
  }

  function persistOnHidden() {
    if (document.visibilityState === 'hidden') persist()
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', persistOnHidden)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', persist)
  }

  syncTimer()
  onScopeDispose(() => {
    if (timerHandle !== null) clearInterval(timerHandle)
    if (animationTimer !== null) clearTimeout(animationTimer)
    // Named handlers (rather than inline closures) so this instance's
    // listeners can actually be removed — without this, every store
    // re-instantiation (dev HMR, multiple test/store instances) would pile
    // up another pair of listeners forever, each still closing over this
    // instance's now-abandoned `state`/`persist`.
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', persistOnHidden)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', persist)
    }
  })

  return {
    state,
    seedHistory,
    canUndo,
    isWon,
    isPlayable,
    canAutoComplete,
    isAnimating,
    isAutoCompleting,
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
