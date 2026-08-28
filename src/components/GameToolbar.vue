<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/game'
import SettingsPanel from './SettingsPanel.vue'

const store = useGameStore()
const seedInput = ref('')
// Which action is waiting on the discard-confirmation overlay below, if
// any — set instead of switching games immediately whenever there's real,
// unfinished progress (moved at least once, not already won) that would
// otherwise be silently lost.
const pendingAction = ref<'new' | 'seed' | null>(null)

function needsDiscardConfirmation(): boolean {
  return store.state.moveCount > 0 && store.state.status !== 'won'
}

function performNewGame() {
  store.newGame()
  seedInput.value = ''
}

function startNewGame() {
  if (needsDiscardConfirmation()) {
    pendingAction.value = 'new'
    return
  }
  performNewGame()
}

// v-model on a native <input type="number"> hands back a number once a
// value has been typed (not always a string, despite seedInput's type),
// so this must coerce before checking for blank rather than assuming string.
const canStartWithSeed = computed(() => String(seedInput.value).trim() !== '')

function performStartWithSeed() {
  // Defense in depth alongside the submit button's :disabled binding below —
  // Number('') is 0, a "valid" seed, so an empty field must be rejected
  // explicitly here too rather than relying only on the button being
  // disabled (e.g. pressing Enter in the field doesn't always respect it).
  if (!canStartWithSeed.value) return
  const seed = Number(seedInput.value)
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return
  store.newGame(seed)
}

function startWithSeed() {
  if (!canStartWithSeed.value) return
  if (needsDiscardConfirmation()) {
    pendingAction.value = 'seed'
    return
  }
  performStartWithSeed()
}

function confirmPendingAction() {
  if (pendingAction.value === 'new') performNewGame()
  else if (pendingAction.value === 'seed') performStartWithSeed()
  pendingAction.value = null
}

function cancelPendingAction() {
  pendingAction.value = null
}

function togglePause() {
  if (store.state.status === 'paused') {
    store.resume()
  } else {
    store.pause()
  }
}

function handleUndo() {
  if (store.isAnimating) return
  store.undo()
}

function handleAutoComplete() {
  if (store.isAnimating) return
  store.autoComplete()
}

const formattedElapsed = computed(() => {
  const total = store.state.elapsedSeconds
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
})
</script>

<template>
  <div class="toolbar">
    <div class="actions">
      <button type="button" class="btn" aria-label="New Game" @click="startNewGame">New</button>
      <button
        type="button"
        class="btn icon-btn"
        aria-label="Undo"
        :disabled="!store.canUndo || store.isAnimating"
        @click="handleUndo"
      >
        ↩️
      </button>
      <button
        type="button"
        class="btn icon-btn"
        :aria-label="store.state.status === 'paused' ? 'Resume' : 'Pause'"
        :disabled="store.isWon"
        @click="togglePause"
      >
        {{ store.state.status === 'paused' ? '▶️' : '⏸️' }}
      </button>
      <button
        type="button"
        class="btn"
        aria-label="Auto Complete"
        :disabled="!store.canAutoComplete || store.isAnimating"
        @click="handleAutoComplete"
      >
        Auto
      </button>
      <SettingsPanel />
    </div>

    <form class="seed-form" @submit.prevent="startWithSeed">
      <label>
        Seed
        <input v-model="seedInput" type="number" min="0" :max="0xffffffff" />
      </label>
      <button type="submit" class="btn" :disabled="!canStartWithSeed">Start with This Seed</button>
    </form>

    <dl class="stats">
      <div>
        <dt>Score</dt>
        <dd>{{ store.state.score }}</dd>
      </div>
      <div>
        <dt>Time</dt>
        <dd>{{ formattedElapsed }}</dd>
      </div>
      <div>
        <dt>Moves</dt>
        <dd>{{ store.state.moveCount }}</dd>
      </div>
      <div>
        <dt>Seed</dt>
        <dd>{{ store.state.seed }}</dd>
      </div>
    </dl>

    <div
      v-if="pendingAction"
      class="discard-confirm"
      role="alertdialog"
      aria-label="Start a new game?"
    >
      <p class="prompt-title">Start a new game? Your current progress will be lost.</p>
      <div class="prompt-actions">
        <button type="button" class="btn" @click="confirmPendingAction">YES</button>
        <button type="button" class="btn" @click="cancelPendingAction">NO</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.5rem;
  padding: 0.5rem 1rem;
  background: var(--color-felt-dark);
  color: var(--color-text-on-dark);
}

.actions {
  display: flex;
  /* Belt-and-suspenders: the icon/abbreviated buttons below already fit one
     row on real phone widths, but this still wraps rather than silently
     clipping a button off-screen (html/body's overflow: hidden means a
     clipped button would otherwise be permanently unreachable) on anything
     narrower, or at larger accessibility zoom/font-size settings. */
  flex-wrap: wrap;
  gap: 0.5rem;
}

.icon-btn {
  min-width: 2.75rem;
  padding: 0.5rem;
  font-size: 1.25rem;
  line-height: 1;
}

.seed-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.seed-form input {
  width: 8rem;
  min-height: 2.75rem;
  padding: 0 0.5rem;
  font: inherit;
  box-sizing: border-box;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 0;
}

.stats > div {
  display: flex;
  gap: 0.25rem;
}

.stats dt {
  font-weight: bold;
}

.stats dd {
  margin: 0;
}

/* Matches GameBoard.vue's .auto-complete-prompt look exactly, but this
   component sits outside .game-board (a sibling, not a descendant), so
   position: fixed is used instead of absolute to still cover the whole
   viewport rather than just the toolbar's own bounding box. */
.discard-confirm {
  position: fixed;
  inset: 0;
  z-index: var(--z-blocking-overlay);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  background: rgba(0, 0, 0, 0.75);
  color: var(--color-text-on-dark);
  text-align: center;
  padding: 1rem;
}

.prompt-title {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0;
}

.prompt-actions {
  display: flex;
  gap: 1rem;
}

.prompt-actions button {
  min-width: 5rem;
  padding: 0.5rem 1.5rem;
  font-size: 1rem;
}
</style>
