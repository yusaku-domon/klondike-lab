<script setup lang="ts">
import { useGameStore } from '../stores/game'

// True while something that should own all input is showing in front of
// the board (the sidebar panel, in practice — see the prop doc below).
// Modals/confirmation dialogs need no equivalent prop: they're already
// position: fixed; inset: 0 at a higher z-index than this bar (see
// .mobile-play-bar below), so they already cover and intercept clicks
// meant for it with no extra wiring.
const props = defineProps<{
  /** The sidebar is a left-anchored panel, not a full-viewport overlay —
   * unlike the modals, its own z-index stacking doesn't reliably cover
   * this bar's whole width on a wide phone, so it's the one case that
   * needs an explicit disable rather than relying on layering alone. */
  sidebarOpen: boolean
}>()

const store = useGameStore()

function handleUndo() {
  if (store.isAnimating) return
  store.undo()
}

function handleRedo() {
  if (store.isAnimating) return
  store.redo()
}

function togglePause() {
  if (store.state.status === 'paused') {
    store.resume()
  } else {
    store.pause()
  }
}
</script>

<template>
  <div class="mobile-play-bar" :class="{ 'mobile-play-bar--inert': sidebarOpen }" role="group" aria-label="Play controls">
    <button
      type="button"
      class="play-bar-btn"
      aria-label="Undo"
      :disabled="!store.canUndo || store.isAnimating || props.sidebarOpen"
      @click="handleUndo"
    >
      <span class="play-bar-icon" aria-hidden="true">↩</span>
      <span class="play-bar-label">Undo</span>
    </button>
    <button
      type="button"
      class="play-bar-btn"
      :aria-label="store.state.status === 'paused' ? 'Resume' : 'Pause'"
      :disabled="store.isWon || props.sidebarOpen"
      @click="togglePause"
    >
      <span class="play-bar-icon" aria-hidden="true">{{ store.state.status === 'paused' ? '▶' : '⏸' }}</span>
      <span class="play-bar-label">{{ store.state.status === 'paused' ? 'Resume' : 'Pause' }}</span>
    </button>
    <button
      type="button"
      class="play-bar-btn"
      aria-label="Redo"
      :disabled="!store.canRedo || store.isAnimating || props.sidebarOpen"
      @click="handleRedo"
    >
      <span class="play-bar-icon play-bar-icon--mirror" aria-hidden="true">↩</span>
      <span class="play-bar-label">Redo</span>
    </button>
  </div>
</template>

<style scoped>
/* Hidden entirely above the breakpoint — GameToolbar.vue's own
   .header-play-control buttons are what PC uses instead. Keep this
   600px literal in sync with that other file's own media query. */
.mobile-play-bar {
  display: none;
}

@media (max-width: 600px) {
  .mobile-play-bar {
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    gap: 4px;
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(var(--mobile-play-bar-offset) + env(safe-area-inset-bottom));
    width: calc(100vw - 24px);
    max-width: 360px;
    height: var(--mobile-play-bar-height);
    box-sizing: border-box;
    padding: 4px;
    border-radius: 999px;
    border: 2px solid var(--color-sidebar-toggle-accent);
    /* Same dark green + translucency as GameToolbar.vue's own .toolbar
       background-color, reused verbatim for visual consistency between the
       two — this bar sits directly over GameView.vue's shared felt image,
       just like the header does. */
    background-color: rgba(11, 61, 36, 0.85);
    color: var(--color-text-on-dark);
    /* Sits above ordinary board content (cards, at their default z-index:
       auto) so nothing shows through it, but below the sidebar/modals'
       own higher tiers (see the prop doc above) so those still cover and
       block it without any extra coordination. */
    z-index: var(--z-card-layer);
  }
}

.mobile-play-bar--inert {
  opacity: 0.6;
  pointer-events: none;
}

.play-bar-btn {
  flex: 1;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  appearance: none;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.play-bar-btn:active:not(:disabled),
.play-bar-btn:focus-visible:not(:disabled) {
  /* A subtle brightness shift for feedback — same technique as
     Sidebar.vue's own .sidebar-item hover/focus/active state — rather than
     any shadow or press-down transform, per the flat, no-depth look this
     bar is meant to have. */
  background: rgba(255, 255, 255, 0.12);
}

.play-bar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.play-bar-icon {
  font-family: 'Press Start 2P', monospace;
  font-weight: 400;
  font-size: 1rem;
  line-height: 1;
}

.play-bar-icon--mirror {
  display: inline-block;
  transform: scaleX(-1);
}

.play-bar-label {
  font-size: 0.65rem;
}
</style>
