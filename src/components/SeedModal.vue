<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/game'

const store = useGameStore()
const seedInput = ref('')
// Shows a discard-confirmation in place of the form below, inside this same
// modal card, instead of stacking a second overlay on top — sidesteps any
// z-index ordering between the two entirely.
const pendingConfirm = ref(false)

defineEmits<{ close: [] }>()

// v-model on a native <input type="number"> hands back a number once a
// value has been typed (not always a string, despite seedInput's type), so
// this must coerce before checking for blank rather than assuming string.
const canStartWithSeed = computed(() => String(seedInput.value).trim() !== '')

function needsDiscardConfirmation(): boolean {
  return store.state.moveCount > 0 && store.state.status !== 'won'
}

function performStartWithSeed() {
  // Defense in depth alongside the submit button's :disabled binding below —
  // Number('') is 0, a "valid" seed, so an empty field must be rejected
  // explicitly here too rather than relying only on the button being
  // disabled (e.g. pressing Enter in the field doesn't always respect it).
  if (!canStartWithSeed.value) return
  const seed = Number(seedInput.value)
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return
  store.newGame(seed)
  seedInput.value = ''
}

function startWithSeed() {
  if (!canStartWithSeed.value) return
  if (needsDiscardConfirmation()) {
    pendingConfirm.value = true
    return
  }
  performStartWithSeed()
}

function confirmDiscard() {
  performStartWithSeed()
  pendingConfirm.value = false
}

function cancelDiscard() {
  pendingConfirm.value = false
}

async function copySeed(seed: number) {
  try {
    await navigator.clipboard.writeText(String(seed))
  } catch {
    // Clipboard access can fail (permissions, insecure context, unsupported
    // browser) — non-fatal, the seed is still visible on screen to copy
    // manually.
  }
}
</script>

<template>
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Seed">
    <div class="modal-card">
      <button
        type="button"
        class="btn icon-btn modal-close"
        aria-label="Close"
        @click="$emit('close')"
      >
        ×
      </button>

      <template v-if="pendingConfirm">
        <h2 class="modal-title">Start a new game?</h2>
        <p>Your current progress will be lost.</p>
        <div class="prompt-actions">
          <button type="button" class="btn" @click="confirmDiscard">YES</button>
          <button type="button" class="btn" @click="cancelDiscard">NO</button>
        </div>
      </template>

      <template v-else>
        <h2 class="modal-title">Seed</h2>
        <form class="seed-form" @submit.prevent="startWithSeed">
          <label>
            Seed
            <input v-model="seedInput" type="number" min="0" :max="0xffffffff" />
          </label>
          <button type="submit" class="btn" :disabled="!canStartWithSeed">Start with This Seed</button>
        </form>

        <h3 class="history-title">History</h3>
        <ul v-if="store.seedHistory.length > 0" class="history-list">
          <li v-for="(entry, index) in store.seedHistory" :key="index" class="history-row">
            <span class="history-seed">{{ entry.seed }}</span>
            <button
              type="button"
              class="btn icon-btn"
              :aria-label="`Copy seed ${entry.seed}`"
              @click="copySeed(entry.seed)"
            >
              📋
            </button>
            <span class="history-result" :class="entry.result">
              {{ entry.result === 'win' ? 'Win' : 'Lose' }}
            </span>
          </li>
        </ul>
        <p v-else class="history-empty">No finished games yet.</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-blocking-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  padding: 1rem;
}

.modal-card {
  position: relative;
  background: var(--color-felt);
  border: 1px solid var(--color-outline);
  border-radius: 0.4rem;
  padding: 1.5rem;
  min-width: 16rem;
  max-width: 90vw;
  color: var(--color-text-on-dark);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}

.icon-btn {
  min-width: 2.75rem;
  padding: 0.5rem;
  font-family: 'Press Start 2P', monospace;
  font-weight: 400;
  font-size: 1.25rem;
  line-height: 1;
}

.modal-close {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
}

.modal-title {
  margin: 0 0 1rem;
  font-size: 1.25rem;
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

.history-title {
  margin: 1.5rem 0 0.5rem;
  font-size: 1rem;
}

.history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.history-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.history-seed {
  min-width: 8rem;
}

.history-result {
  font-weight: bold;
}

.history-result.win {
  color: var(--color-selected);
}

.history-result.lose {
  /* Not var(--color-suit-red) — that color is tuned for card text on a
     white card face, and reads too dark/low-contrast on this modal's felt
     background. */
  color: #ff5252;
}

.history-empty {
  margin: 0;
  opacity: 0.8;
}
</style>
