<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import SeedModal from './SeedModal.vue'
import SettingsModal from './SettingsModal.vue'
import SidebarToggleIcon from './SidebarToggleIcon.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; 'fully-closed': [] }>()

const activeModal = ref<'settings' | 'seed' | null>(null)
const asideEl = ref<HTMLElement | null>(null)

function closeModal() {
  activeModal.value = null
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

// Fires for both the opening and closing slide — only the closing one
// (props.open already false by the time its own transition ends) should
// tell GameView.vue it's safe to show the header's open button again.
// event.target excludes bubbled transitionend from unrelated descendants
// (e.g. a modal's own transitions, if it ever gets one).
function handleTransitionEnd(event: TransitionEvent) {
  if (event.target !== asideEl.value) return
  if (event.propertyName !== 'transform') return
  if (!props.open) emit('fully-closed')
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
  <aside
    id="app-sidebar"
    ref="asideEl"
    class="sidebar"
    :class="{ 'sidebar--open': open }"
    @transitionend="handleTransitionEnd"
  >
    <!-- A real DOM child of the sliding <aside>, not a separately
         positioned/animated element — it has no transform or transition
         of its own, so it rides along with the panel's own slide with
         zero risk of drifting out of sync. -->
    <button
      v-if="open"
      type="button"
      class="btn sidebar-toggle sidebar-close"
      aria-label="サイドバーを閉じる"
      aria-controls="app-sidebar"
      aria-expanded="true"
      @click="emit('close')"
    >
      <SidebarToggleIcon :open="true" />
    </button>

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
  /* Same felt image GameView.vue/GameBoard.vue use for the header and
     board (see THIRD_PARTY_NOTICES.md), so the panel reads as part of the
     same family of surfaces — but kept fully opaque, unlike the header's
     translucent rgba() background-color: both layers here are 100%
     opaque (the image has no alpha channel, and this flat overlay is a
     second full background layer, not the whole .sidebar element's own
     opacity), so nothing behind the panel — cards, buttons — can ever
     show through it, open or mid-slide. #0b3d24 at 90% keeps the panel
     reading as the same solid dark green as before; if the weave ever
     reads as too busy, this is the one number to raise (try 92%) rather
     than adding a second overlay or touching the image itself. */
  background-color: #0b3d24;
  background-image: linear-gradient(rgba(11, 61, 36, 0.9), rgba(11, 61, 36, 0.9)),
    url('../assets/textures/board-felt.webp');
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  z-index: var(--z-dropdown);
  transform: translateX(-100%);
  transition: transform 0.25s ease;
  overflow-y: auto;
}

/* Root cause of a reported dark line down the left/top edge of the game
   board: box-shadow (and border-right) paint outside the element's own
   box, so even with the panel fully translated off-screen at rest, its
   shadow's blur/offset still reached back onto the visible viewport edge.
   Scoped to the open state only — there's nothing to visually separate
   the panel from while it isn't shown anyway. */
.sidebar--open {
  transform: translateX(0);
  border-right: 1px solid rgba(0, 0, 0, 0.12);
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
}

/* position: absolute against the <aside> (already positioned via its own
   fixed+transform), not position: fixed of its own — this is what keeps
   it from ever needing (or being able to drift from) its own transform:
   it simply sits at a fixed offset within the panel's box, and moves
   exactly when/as much as the panel itself does. */
.sidebar-close {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  /* Extra top padding clears .sidebar-close's own footprint (0.5rem inset
     + 2.75rem button = 3.25rem from the panel's top edge) so the first
     menu item's row never sits underneath it. */
  padding: 3.5rem 0 1rem;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 2.75rem;
  padding: 0.75rem 1.25rem;
  border: none;
  background: none;
  color: var(--color-text-on-dark);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.sidebar-item:hover,
.sidebar-item:focus-visible,
.sidebar-item:active {
  background: rgba(255, 255, 255, 0.08);
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
