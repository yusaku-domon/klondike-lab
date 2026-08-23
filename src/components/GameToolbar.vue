<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/game'

const store = useGameStore()
const seedInput = ref('')

function startNewGame() {
  store.newGame()
  seedInput.value = ''
}

function startWithSeed() {
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
      <button type="button" :disabled="!store.canUndo" @click="store.undo()">Undo</button>
      <button type="button" :disabled="store.isWon" @click="togglePause">
        {{ store.state.status === 'paused' ? '再開' : '一時停止' }}
      </button>
    </div>

    <form class="seed-form" @submit.prevent="startWithSeed">
      <label>
        Seed
        <input v-model="seedInput" type="number" min="0" :max="0xffffffff" />
      </label>
      <button type="submit">このseedで開始</button>
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
  background: #0b3d24;
  color: #fff;
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
