<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { CardDesign } from '../persistence/settingsStorage'
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()
const isOpen = ref(false)
const rootEl = ref<HTMLElement | null>(null)

function toggleOpen() {
  isOpen.value = !isOpen.value
}

// Closes the panel on any click outside it (another toolbar button, a
// card, anywhere) without letting that click also trigger whatever it
// landed on — capture phase runs before the target's own bubble-phase
// listener, so stopping it here swallows the click instead of passing it
// through. A click on the toggle button itself is inside rootEl, so this
// leaves it alone and toggleOpen's own listener still runs normally.
function handleOutsideClick(event: MouseEvent) {
  if (!isOpen.value) return
  if (rootEl.value && event.target instanceof Node && rootEl.value.contains(event.target)) return
  isOpen.value = false
  event.stopPropagation()
  event.preventDefault()
}

onMounted(() => {
  document.addEventListener('click', handleOutsideClick, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick, true)
})
</script>

<template>
  <div ref="rootEl" class="settings-panel">
    <button
      type="button"
      class="btn"
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
