<script setup lang="ts">
import type { CardDesign } from '../persistence/settingsStorage'
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()
defineEmits<{ close: [] }>()
</script>

<template>
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Settings">
    <div class="modal-card">
      <button
        type="button"
        class="btn icon-btn modal-close"
        aria-label="Close"
        @click="$emit('close')"
      >
        ×
      </button>
      <h2 class="modal-title">Settings</h2>

      <label class="setting-row">
        <input
          type="checkbox"
          :checked="settings.moveNavigationEnabled"
          @change="settings.setMoveNavigationEnabled(($event.target as HTMLInputElement).checked)"
        />
        Move Navigation
      </label>

      <label class="setting-row">
        Card Design
        <select
          :value="settings.cardDesign"
          @change="settings.setCardDesign(($event.target as HTMLSelectElement).value as CardDesign)"
        >
          <option value="classic">Classic</option>
          <option value="saulspatz">Saul Spatz</option>
        </select>
      </label>
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

.setting-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  white-space: nowrap;
  cursor: pointer;
  box-sizing: border-box;
}

.setting-row input[type='checkbox'] {
  width: 1.25rem;
  height: 1.25rem;
}

.setting-row select {
  min-height: 2.5rem;
  padding: 0.25rem 0.5rem;
  font: inherit;
}
</style>
