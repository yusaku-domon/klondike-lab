<script setup lang="ts">
import { ref } from 'vue'
import SeedModal from './SeedModal.vue'
import SettingsModal from './SettingsModal.vue'

const isOpen = ref(false)
const activeModal = ref<'settings' | 'seed' | null>(null)

function toggleOpen() {
  isOpen.value = !isOpen.value
}

function closeModal() {
  activeModal.value = null
}
</script>

<template>
  <button
    type="button"
    class="btn icon-btn"
    aria-label="Toggle sidebar"
    :aria-expanded="isOpen"
    @click="toggleOpen"
  >
    ≡
  </button>
  <template v-if="isOpen">
    <button type="button" class="btn icon-btn" aria-label="Settings" @click="activeModal = 'settings'">
      ⚙
    </button>
    <button type="button" class="btn icon-btn" aria-label="Seed" @click="activeModal = 'seed'">
      🌱
    </button>
  </template>

  <SettingsModal v-if="activeModal === 'settings'" @close="closeModal" />
  <SeedModal v-if="activeModal === 'seed'" @close="closeModal" />
</template>

<style scoped>
.icon-btn {
  min-width: 2.75rem;
  padding: 0.5rem;
  font-family: 'Press Start 2P', monospace;
  font-weight: 400;
  font-size: 1.25rem;
  line-height: 1;
}
</style>
