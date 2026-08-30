<script setup lang="ts">
import { useGameStore } from '../stores/game'

// Same prop/reasoning as MobilePlayBar.vue's own sidebarOpen — the sidebar
// is a left-anchored panel, not a full-viewport overlay, so it's the one
// case that needs an explicit disable here rather than relying on layering
// alone. Modals/confirmation dialogs need no equivalent prop: they're
// already position: fixed; inset: 0 at a higher z-index than this button
// (see .auto-finish-btn below), so they already cover and intercept clicks
// meant for it with no extra wiring.
const props = defineProps<{ sidebarOpen: boolean }>()

const store = useGameStore()

// Mirrors GameToolbar.vue's own handleAutoComplete exactly (both just call
// through to the store) rather than sharing a literal function reference —
// same relationship MobilePlayBar.vue already has with the header's
// Undo/Redo/Pause handlers. The store, not either handler, is the single
// source of truth this duplicates nothing from.
function handleAutoComplete() {
  if (store.isAnimating) return
  store.autoComplete()
}
</script>

<template>
  <Transition name="auto-finish-fade">
    <!-- Unlike GameToolbar.vue's own Auto button (always visible, disabled
         until canAutoComplete), this one only ever mounts once auto-complete
         is actually available — and unmounts the instant a cascade starts
         (isAnimating), rather than staying present-but-disabled, so a
         second click can never queue up behind the first. store.autoComplete()
         itself already no-ops on a re-entrant call regardless — this is
         belt-and-suspenders at the UI layer on top of that. -->
    <button
      v-if="store.canAutoComplete && !store.isAnimating"
      type="button"
      class="auto-finish-btn"
      :class="{ 'auto-finish-btn--inert': sidebarOpen }"
      aria-label="Auto Finish"
      :disabled="props.sidebarOpen"
      @click="handleAutoComplete"
    >
      <svg class="auto-finish-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 1 L9.2 6.8 L15 8 L9.2 9.2 L8 15 L6.8 9.2 L1 8 L6.8 6.8 Z" />
      </svg>
      <span class="auto-finish-label">Auto Finish</span>
    </button>
  </Transition>
</template>

<style scoped>
/* Hidden entirely above the breakpoint — GameToolbar.vue's own Auto button
   (a .header-play-control there) is what PC uses instead. Keep this 600px
   literal in sync with MobilePlayBar.vue's/GameToolbar.vue's own. */
.auto-finish-btn {
  display: none;
}

@media (max-width: 600px) {
  .auto-finish-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    /* Sits directly above the play bar with its own --mobile-auto-finish-gap
       breathing room — reads from the bar's own height/offset tokens
       (style.css) rather than a second, independently-guessed number, so
       the two can never drift apart even though they're separate elements
       with no shared parent to lay them out as a stack. */
    bottom: calc(
      var(--mobile-play-bar-offset) + env(safe-area-inset-bottom) + var(--mobile-play-bar-height) +
        var(--mobile-auto-finish-gap)
    );
    min-height: var(--mobile-auto-finish-height);
    min-width: 44px;
    box-sizing: border-box;
    padding: 0 1rem;
    border-radius: 999px;
    border: 2px solid var(--color-sidebar-toggle-accent);
    /* Same dark green + translucency as the play bar's/header's own
       background-color — reads as the same family of floating controls
       rather than a new, separately-invented style. */
    background-color: rgba(11, 61, 36, 0.85);
    color: var(--color-text-on-dark);
    font: inherit;
    cursor: pointer;
    /* Sits above ordinary board content, same default tier as
       MobilePlayBar.vue. Unlike that bar, this never needs a paused-only
       elevated tier: canAutoComplete already requires status === 'playing'
       (see domain/autoComplete.ts), and isAnimating stays true for the
       full duration of a cascade even while paused mid-cascade — so this
       button is v-if-removed before pausing could ever apply to it. */
    z-index: var(--z-card-layer);
  }
}

.auto-finish-btn--inert {
  opacity: 0.6;
  pointer-events: none;
}

.auto-finish-btn:active:not(:disabled),
.auto-finish-btn:focus-visible:not(:disabled) {
  /* A subtle brightness shift for feedback, layered over (not replacing)
     the base background-color so the dark green tint still shows through —
     same flat, no-shadow/no-3D treatment as the play bar's own buttons. */
  background-image: linear-gradient(rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.12));
}

.auto-finish-icon {
  width: 0.9rem;
  height: 0.9rem;
  flex: none;
}

.auto-finish-label {
  font-size: 0.85rem;
}

.auto-finish-fade-enter-active {
  transition: opacity 180ms ease-out;
}

.auto-finish-fade-enter-from {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .auto-finish-fade-enter-active {
    transition: none;
  }
}
</style>
