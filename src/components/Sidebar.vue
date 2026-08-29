<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import SeedModal from './SeedModal.vue'
import SettingsModal from './SettingsModal.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const activeModal = ref<'settings' | 'seed' | null>(null)

function closeModal() {
  activeModal.value = null
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

// Only listens while open, so Escape presses elsewhere in the app (e.g. a
// card drag) never reach this handler.
watch(
  () => props.open,
  (open) => {
    if (open) {
      document.addEventListener('keydown', handleKeydown)
    } else {
      document.removeEventListener('keydown', handleKeydown)
      // Closing the panel mid-modal shouldn't leave it re-openable to a
      // stale modal the next time the sidebar opens.
      activeModal.value = null
    }
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <aside id="app-sidebar" class="sidebar" :class="{ 'sidebar--open': open }">
    <nav v-if="open" class="sidebar-nav" aria-label="Sidebar menu">
      <button
        type="button"
        class="sidebar-item"
        aria-label="Settings"
        @click="activeModal = 'settings'"
      >
        <span class="sidebar-icon" aria-hidden="true">⚙</span>
        <span class="sidebar-label">Settings</span>
      </button>
      <button type="button" class="sidebar-item" aria-label="Seed" @click="activeModal = 'seed'">
        <span class="sidebar-icon" aria-hidden="true">🌱</span>
        <span class="sidebar-label">Seed</span>
      </button>
    </nav>
  </aside>

  <SettingsModal v-if="activeModal === 'settings'" @close="closeModal" />
  <SeedModal v-if="activeModal === 'seed'" @close="closeModal" />
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  width: var(--sidebar-width);
  box-sizing: border-box;
  background: #ffffff;
  border-right: 1px solid rgba(0, 0, 0, 0.12);
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
  z-index: var(--z-dropdown);
  transform: translateX(-100%);
  transition: transform 0.25s ease;
  overflow-y: auto;
}

.sidebar--open {
  transform: translateX(0);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: 1rem 0;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 2.75rem;
  padding: 0.75rem 1.25rem;
  border: none;
  background: none;
  color: #1a1a1a;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.sidebar-item:hover {
  background: rgba(0, 0, 0, 0.06);
}

.sidebar-icon {
  font-family: 'Press Start 2P', monospace;
  font-weight: 400;
  font-size: 1.1rem;
  line-height: 1;
  width: 1.5rem;
  text-align: center;
}

.sidebar-label {
  font-size: 1rem;
}
</style>
