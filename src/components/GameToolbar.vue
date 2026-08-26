<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/game'
import SettingsPanel from './SettingsPanel.vue'

const store = useGameStore()
const seedInput = ref('')

function startNewGame() {
  store.newGame()
  seedInput.value = ''
}

// v-model on a native <input type="number"> hands back a number once a
// value has been typed (not always a string, despite seedInput's type),
// so this must coerce before checking for blank rather than assuming string.
const canStartWithSeed = computed(() => String(seedInput.value).trim() !== '')

function startWithSeed() {
  // Defense in depth alongside the submit button's :disabled binding below —
  // Number('') is 0, a "valid" seed, so an empty field must be rejected
  // explicitly here too rather than relying only on the button being
  // disabled (e.g. pressing Enter in the field doesn't always respect it).
  if (!canStartWithSeed.value) return
  const seed = Number(seedInput.value)
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return
  store.newGame(seed)
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
      <button type="button" @click="startNewGame">新しいゲーム</button>
      <button type="button" :disabled="!store.canUndo || store.isAnimating" @click="handleUndo">
        Undo
      </button>
      <button type="button" :disabled="store.isWon" @click="togglePause">
        {{ store.state.status === 'paused' ? '再開' : '一時停止' }}
      </button>
      <button
        type="button"
        :disabled="!store.canAutoComplete || store.isAnimating"
        @click="handleAutoComplete"
      >
        自動で仕上げる
      </button>
      <SettingsPanel />
    </div>

    <form class="seed-form" @submit.prevent="startWithSeed">
      <label>
        Seed
        <input v-model="seedInput" type="number" min="0" :max="0xffffffff" />
      </label>
      <button type="submit" :disabled="!canStartWithSeed">このseedで開始</button>
    </form>

    <dl class="stats">
      <div>
        <dt>スコア</dt>
        <dd>{{ store.state.score }}</dd>
      </div>
      <div>
        <dt>経過時間</dt>
        <dd>{{ formattedElapsed }}</dd>
      </div>
      <div>
        <dt>手数</dt>
        <dd>{{ store.state.moveCount }}</dd>
      </div>
      <div>
        <dt>Seed</dt>
        <dd>{{ store.state.seed }}</dd>
      </div>
    </dl>
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
  gap: 0.5rem;
}

.seed-form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.seed-form input {
  width: 8rem;
}

.stats {
  display: flex;
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

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
