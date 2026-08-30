<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

// Mobile-only (<=600px) replacement for the PC sidebar at this breakpoint —
// GameToolbar.vue's own chevron button is hidden entirely here (see its
// .sidebar-toggle--pc rule), so this is the sole "open the menu" control on
// a phone-width screen. Deliberately a totally different interaction (a
// small capsule overlay, not a full-height sliding panel) rather than
// reusing Sidebar.vue's own markup, per the redesign spec — but it reuses
// the exact same activeModal wiring one level up in GameView.vue, so
// Settings/Seed's own event handling is never duplicated.
const emit = defineEmits<{ select: [item: 'settings' | 'seed'] }>()

const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)
const toggleButtonEl = ref<HTMLButtonElement | null>(null)

function closeAndRestoreFocus() {
  open.value = false
  // Only meaningful when focus had moved into the panel (e.g. Tabbing
  // through Settings/Seed) — harmless no-op when the toggle button already
  // has focus, as it does right after the user clicks it to close.
  toggleButtonEl.value?.focus()
}

function toggle() {
  if (open.value) {
    closeAndRestoreFocus()
  } else {
    open.value = true
  }
}

function select(item: 'settings' | 'seed') {
  // Closes without stealing focus back to the toggle button — the modal
  // this opens (see GameView.vue) is what the user's attention moves to
  // next, not a background control that's about to sit behind it.
  open.value = false
  emit('select', item)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeAndRestoreFocus()
}

function handlePointerDown(event: PointerEvent) {
  if (rootEl.value && !rootEl.value.contains(event.target as Node)) {
    // A plain close here, not closeAndRestoreFocus — the user's pointer is
    // already elsewhere on the board doing something else; yanking focus
    // back to the toggle button would fight whatever they just clicked.
    open.value = false
  }
}

// Only listens while open, same reasoning as Sidebar.vue's own equivalent
// watcher — Escape/clicks elsewhere shouldn't do anything while this menu
// isn't showing.
watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('pointerdown', handlePointerDown)
  } else {
    document.removeEventListener('keydown', handleKeydown)
    document.removeEventListener('pointerdown', handlePointerDown)
  }
})

// Resizing past the breakpoint doesn't change which controls are shown —
// that stays entirely CSS-driven (this component is display: none above
// 600px regardless of `open`) — this only clears the now-irrelevant open
// state so it can't silently reappear pre-opened if the viewport later
// shrinks back below 600px, and so it can never coexist with the PC
// sidebar's own state. Not device-type detection: it never decides which
// markup renders, only resets this component's own local state.
//
// Guarded rather than called unconditionally: jsdom (this app's test
// environment) doesn't implement matchMedia at all, so an unguarded call
// would throw on every mount in every test, not just this component's own.
const breakpointQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 600px)') : null
function handleBreakpointChange(event: MediaQueryListEvent) {
  if (!event.matches) open.value = false
}
breakpointQuery?.addEventListener('change', handleBreakpointChange)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('pointerdown', handlePointerDown)
  breakpointQuery?.removeEventListener('change', handleBreakpointChange)
})
</script>

<template>
  <div ref="rootEl" class="mobile-sidebar-menu" :class="{ 'mobile-sidebar-menu--open': open }">
    <button
      ref="toggleButtonEl"
      type="button"
      class="menu-toggle"
      :aria-label="open ? 'メニューを閉じる' : 'メニューを開く'"
      aria-controls="mobile-sidebar-menu-panel"
      :aria-expanded="open"
      @click="toggle"
    >
      <!-- Three lines collapsed, the same X path SidebarToggleIcon.vue uses
           for its own "close" state expanded — one visual language for
           "this control means close" across the whole app. -->
      <svg v-if="!open" class="menu-toggle-icon" viewBox="0 0 16 12" aria-hidden="true" focusable="false">
        <line x1="0" y1="1" x2="16" y2="1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        <line x1="0" y1="6" x2="16" y2="6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        <line x1="0" y1="11" x2="16" y2="11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
      <svg v-else class="menu-toggle-icon menu-toggle-icon--close" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
        <path
          d="M3 3 L11 11 M11 3 L3 11"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </svg>
    </button>

    <nav v-show="open" id="mobile-sidebar-menu-panel" class="menu-panel" aria-label="Sidebar menu">
      <button type="button" class="menu-item" aria-label="Settings" @click="select('settings')">
        <svg class="menu-item-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.4" />
          <path
            d="M10 2 V4 M10 16 V18 M2 10 H4 M16 10 H18 M4.5 4.5 L5.9 5.9 M14.1 14.1 L15.5 15.5 M4.5 15.5 L5.9 14.1 M14.1 5.9 L15.5 4.5"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
          />
        </svg>
        <span class="menu-item-label">Settings</span>
      </button>
      <button type="button" class="menu-item" aria-label="Seed" @click="select('seed')">
        <svg class="menu-item-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M10 18 V10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          <path
            d="M10 10 C10 6 6 5 4 5 C4 8 6 10 10 10 Z"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
          <path
            d="M10 10 C10 7 13 6 15 6 C15 9 13 10 10 10 Z"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
        </svg>
        <span class="menu-item-label">Seed</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
/* Hidden entirely above the breakpoint — GameToolbar.vue's own PC toggle
   button (.sidebar-toggle--pc there) is what desktop uses instead. Keep
   this 600px literal in sync with every other file's own media query
   (MobilePlayBar.vue/AutoFinishButton.vue/GameToolbar.vue). */
.mobile-sidebar-menu {
  display: none;
}

@media (max-width: 600px) {
  .mobile-sidebar-menu {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    position: fixed;
    /* Matches .toolbar's own padding (0.5rem 1rem), so this sits exactly
       where GameToolbar.vue's PC toggle button would have been. */
    top: 0.5rem;
    left: 1rem;
    width: 2.75rem;
    height: 2.75rem;
    border: 2px solid var(--color-sidebar-toggle-accent);
    border-radius: 999px;
    background: var(--color-felt-dark);
    /* Clips the nav's own content while the capsule is still short —
       together with the height transition below, this is what makes the
       menu items look like they're revealed as the frame grows, rather
       than instantly appearing at full size. */
    overflow: hidden;
    /* Sits above ordinary board content, below the sidebar/modals' own
       higher tiers — same tier Sidebar.vue's own <aside> uses, since this
       is that same "menu layer" for phone widths. */
    z-index: var(--z-dropdown);
    transition: width 200ms ease-out, height 200ms ease-out;
  }

  .mobile-sidebar-menu--open {
    /* Within the spec's 72-88px range. */
    width: 80px;
    /* Just tall enough for the toggle button (44px) plus two 44px menu
       items — never stretches to the bottom of the screen. */
    height: 140px;
  }
}

.menu-toggle {
  flex: none;
  width: 100%;
  height: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  appearance: none;
  border: none;
  background: transparent;
  color: var(--color-sidebar-toggle-accent);
  cursor: pointer;
}

.menu-toggle-icon {
  width: 1rem;
  height: 0.75rem;
}

.menu-toggle-icon--close {
  width: 0.9rem;
  height: 0.9rem;
}

.menu-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  opacity: 0;
  transition: opacity 150ms ease-out;
}

/* Starts only once the frame's own width/height transition above has had
   time to mostly finish, so the capsule visibly grows first and the
   items fade in after — not simultaneously. */
.mobile-sidebar-menu--open .menu-panel {
  opacity: 1;
  transition-delay: 160ms;
}

.menu-item {
  flex: none;
  width: 100%;
  min-height: 2.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.75rem;
  box-sizing: border-box;
  appearance: none;
  border: none;
  background: none;
  color: var(--color-text-on-dark);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.menu-item:hover,
.menu-item:focus-visible,
.menu-item:active {
  background: rgba(255, 255, 255, 0.08);
}

.menu-item-icon {
  width: 1.1rem;
  height: 1.1rem;
  flex: none;
}

.menu-item-label {
  font-size: 0.8rem;
}

@media (prefers-reduced-motion: reduce) {
  .mobile-sidebar-menu {
    transition: none;
  }

  .menu-panel {
    transition: none;
  }

  .mobile-sidebar-menu--open .menu-panel {
    transition-delay: 0s;
  }
}
</style>
