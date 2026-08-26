<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()
const isOpen = ref(false)

function toggleOpen() {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div class="settings-panel">
    <button
      type="button"
      aria-haspopup="true"
      :aria-expanded="isOpen"
      @click="toggleOpen"
    >
      Settings
    </button>

    <div v-if="isOpen" class="panel" role="region" aria-label="Settings">
      <label class="setting-row">
        <input
          type="checkbox"
          :checked="settings.moveNavigationEnabled"
          @change="settings.setMoveNavigationEnabled(($event.target as HTMLInputElement).checked)"
        />
        Move Navigation
      </label>
    </div>
  </div>
</template>

<style scoped>
.settings-panel {
  position: relative;
}

.panel {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: var(--z-dropdown);
  min-width: 12rem;
  padding: 0.75rem 1rem;
  background: var(--color-felt);
  border: 1px solid var(--color-outline);
  border-radius: 0.4rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
  cursor: pointer;
}
</style>
