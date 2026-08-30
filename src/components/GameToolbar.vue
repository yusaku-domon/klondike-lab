<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/game'
import SidebarToggleIcon from './SidebarToggleIcon.vue'

defineProps<{ showSidebarToggle: boolean }>()
defineEmits<{ 'open-sidebar': [] }>()

const store = useGameStore()
// Whether the New-Game discard-confirmation overlay below is showing — set
// instead of switching games immediately whenever there's real, unfinished
// progress (moved at least once, not already won) that would otherwise be
// silently lost. (Start with This Seed has its own, separate copy of this
// same confirmation inside SeedModal.vue.)
const pendingNewGame = ref(false)

function needsDiscardConfirmation(): boolean {
  return store.state.moveCount > 0 && store.state.status !== 'won'
}

function performNewGame() {
  store.newGame()
}

function startNewGame() {
  if (needsDiscardConfirmation()) {
    pendingNewGame.value = true
    return
  }
  performNewGame()
}

function confirmNewGame() {
  performNewGame()
  pendingNewGame.value = false
}

function cancelNewGame() {
  pendingNewGame.value = false
}

function togglePause() {
  if (store.state.status === 'paused') {
    store.resume()
  } else {
    store.pause()
  }
}

function handleUndo() {
  if (store.isAnimating) return
  store.undo()
}

function handleRedo() {
  if (store.isAnimating) return
  store.redo()
}

function handleAutoComplete() {
  if (store.isAnimating) return
  store.autoComplete()
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
      <!-- Only ever represents "closed, click to open" — hidden the instant
           it's clicked and only shown again once Sidebar.vue's own close
           animation actually finishes (GameView.vue tracks that), so this
           and Sidebar.vue's in-panel close button are never both visible.
           This button never itself moves to sit inside the sidebar (that
           was tried before and reads as visually "detached" from the panel
           mid-slide) — instead the sidebar gets its OWN close button,
           rendered as a real DOM child of the sliding <aside> so it moves
           with zero position/transition logic of its own. -->
      <button
        v-if="showSidebarToggle"
        type="button"
        class="btn sidebar-toggle"
        aria-label="サイドバーを開く"
        aria-controls="app-sidebar"
        aria-expanded="false"
        @click="$emit('open-sidebar')"
      >
        <SidebarToggleIcon :open="false" />
      </button>
      <button type="button" class="btn" aria-label="New Game" @click="startNewGame">New</button>
      <!-- These three (Undo/Pause/Redo) are the ones that move to
           MobilePlayBar.vue's fixed bottom bar at the same ≤600px
           breakpoint — .header-play-control hides them here so they're
           never shown (or clickable) in both places at once. New/Auto/the
           sidebar toggle and the stats below are unaffected and stay put
           on every screen size. -->
      <button
        type="button"
        class="btn icon-btn header-play-control"
        aria-label="Undo"
        :disabled="!store.canUndo || store.isAnimating"
        @click="handleUndo"
      >
        ↩
      </button>
      <button
        type="button"
        class="btn icon-btn header-play-control"
        aria-label="Redo"
        :disabled="!store.canRedo || store.isAnimating"
        @click="handleRedo"
      >
        <span class="icon-mirror">↩</span>
      </button>
      <button
        type="button"
        class="btn icon-btn header-play-control"
        :aria-label="store.state.status === 'paused' ? 'Resume' : 'Pause'"
        :disabled="store.isWon"
        @click="togglePause"
      >
        {{ store.state.status === 'paused' ? '▶' : '⏸' }}
      </button>
      <button
        type="button"
        class="btn"
        aria-label="Auto Complete"
        :disabled="!store.canAutoComplete || store.isAnimating"
        @click="handleAutoComplete"
      >
        Auto
      </button>
    </div>

    <dl class="stats">
      <div>
        <dt>Score</dt>
        <dd>{{ store.state.score }}</dd>
      </div>
      <div>
        <dt>Time</dt>
        <dd>{{ formattedElapsed }}</dd>
      </div>
      <div>
        <dt>Moves</dt>
        <dd>{{ store.state.moveCount }}</dd>
      </div>
      <div>
        <dt>Seed</dt>
        <dd>{{ store.state.seed }}</dd>
      </div>
    </dl>

    <div
      v-if="pendingNewGame"
      class="discard-confirm"
      role="alertdialog"
      aria-label="Start a new game?"
    >
      <p class="prompt-title">Start a new game? Your current progress will be lost.</p>
      <div class="prompt-actions">
        <button type="button" class="btn" @click="confirmNewGame">YES</button>
        <button type="button" class="btn" @click="cancelNewGame">NO</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.5rem;
  padding: 0.5rem 1rem;
  /* Semi-transparent rather than opaque var(--color-felt-dark) (#0b3d24)
     so GameView.vue's felt background shows faintly through the header,
     tying it visually to the board below. Only this background-color has
     alpha — opacity on .toolbar itself would also fade the buttons/text
     inside it, which must stay fully opaque. */
  background-color: rgba(11, 61, 36, 0.85);
  color: var(--color-text-on-dark);
}

.actions {
  display: flex;
  /* Belt-and-suspenders: the icon/abbreviated buttons below already fit one
     row on real phone widths, but this still wraps rather than silently
     clipping a button off-screen (html/body's overflow: hidden means a
     clipped button would otherwise be permanently unreachable) on anything
     narrower, or at larger accessibility zoom/font-size settings. */
  flex-wrap: wrap;
  gap: 0.5rem;
}

.icon-btn {
  min-width: 2.75rem;
  padding: 0.5rem;
  /* Press Start 2P actually ships proper pixel-art glyphs for ↩/⏸/▶ (not
     just Latin text) — confirmed by rendering each one and checking it
     wasn't silently falling back to the system font. font-weight: 400 for
     the same reason as .win-title/.pause-title: this font has one weight. */
  font-family: 'Press Start 2P', monospace;
  font-weight: 400;
  font-size: 1.25rem;
  line-height: 1;
}

/* Redo reuses Undo's own glyph mirrored, rather than a second distinct
   character — same technique as SidebarToggleIcon.vue's chevron, and
   guarantees an identical pixel-art rendering instead of hoping Press
   Start 2P also ships a dedicated "redo" glyph. Scoped to this inner span
   (not the button itself) so it never fights .btn:active's own transform
   on press. */
.icon-mirror {
  display: inline-block;
  transform: scaleX(-1);
}

/* Keep in sync with MobilePlayBar.vue's own breakpoint — both read from
   the same 600px cutoff between "desktop header" and "mobile bottom bar"
   placement for Undo/Pause/Redo. */
@media (max-width: 600px) {
  .header-play-control {
    display: none;
  }
}

.stats {
  display: flex;
  flex-wrap: wrap;
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

/* Matches GameBoard.vue's .auto-complete-prompt look exactly, but this
   component sits outside .game-board (a sibling, not a descendant), so
   position: fixed is used instead of absolute to still cover the whole
   viewport rather than just the toolbar's own bounding box. */
.discard-confirm {
  position: fixed;
  inset: 0;
  z-index: var(--z-blocking-overlay);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  background: rgba(0, 0, 0, 0.75);
  color: var(--color-text-on-dark);
  text-align: center;
  padding: 1rem;
}

.prompt-title {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0;
}

.prompt-actions {
  display: flex;
  gap: 1rem;
}

.prompt-actions button {
  min-width: 5rem;
  padding: 0.5rem 1.5rem;
  font-size: 1rem;
}
</style>
