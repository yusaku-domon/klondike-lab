<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/game'
import SidebarToggleIcon from './SidebarToggleIcon.vue'

defineProps<{ sidebarOpen: boolean }>()
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
      <!-- Only ever represents "closed, click to open" — this button never
           itself moves to sit inside the sidebar (that was tried before and
           reads as visually "detached" from the panel mid-slide); instead
           the sidebar gets its OWN close button, rendered as a real DOM
           child of the sliding <aside> so it moves with zero
           position/transition logic of its own.

           Always mounted, even while the sidebar is open — Sidebar.vue's
           own panel sits at a higher z-index and spans the full viewport
           height (including this header), so once it's open it already
           covers this button's screen position on its own; there's nothing
           for this component to track. inert strips it from focus/click/AT
           exposure for that same span, so a keyboard user can never land on
           a button that's invisible underneath the panel — mouse clicks are
           already naturally caught by the (opaque, higher z-index) panel
           regardless.

           `sidebarOpen || undefined` rather than the bare boolean: inert
           isn't in Vue's own runtime list of attributes it knows to omit
           for a false value (unlike disabled/checked/etc. — its template
           *types* say Booleanish, but that's not what the DOM patcher
           actually special-cases), so :inert="false" would render the
           literal attribute inert="false" — which HTML treats as inert
           anyway, since the attribute's mere presence is what counts, not
           its value. undefined is what actually removes it (null would
           too, but isn't a valid Booleanish per the type).

           PC-only as of the mobile capsule menu redesign: .sidebar-toggle--pc
           hides this entirely at <=600px (see below), where
           MobileSidebarMenu.vue's own hamburger button takes over the same
           top-left role with a completely different (capsule) interaction —
           this button's own trigger disappearing means Sidebar.vue's <aside>
           can never actually open on mobile, so nothing else about it needs
           to change there. -->
      <button
        type="button"
        class="btn sidebar-toggle sidebar-toggle--pc"
        aria-label="サイドバーを開く"
        aria-controls="app-sidebar"
        aria-expanded="false"
        :inert="sidebarOpen || undefined"
        @click="$emit('open-sidebar')"
      >
        <SidebarToggleIcon :open="false" />
      </button>
      <!-- Icon+label markup is shared by both breakpoints (one button, one
           handler — see .new-btn-icon below), so PC and mobile never
           diverge in behavior, only in which parts of this same element
           are visible. On PC the icon stays display: none and this reads
           exactly as the plain "New" button it always was; only at
           <=600px does .new-btn's own media query turn it into the small
           pill this file's header comment describes, pinned to the far
           right of .actions via margin-left: auto (see below) so it lands
           at the header's top-right regardless of whether the sidebar
           toggle before it is currently shown. -->
      <button type="button" class="btn new-btn" aria-label="New Game" @click="startNewGame">
        <svg class="new-btn-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="2" y="3" width="11" height="14" rx="1.5" stroke="currentColor" stroke-width="1.4" />
          <path d="M16 8 V14 M13 11 H19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
        <span class="new-btn-label">New</span>
      </button>
      <!-- These four (Undo/Pause/Redo/Auto) are the ones that move out of
           the header at the same <=600px breakpoint — Undo/Pause/Redo to
           MobilePlayBar.vue's fixed bottom bar, Auto to
           AutoFinishButton.vue's own floating button above that bar (shown
           only once auto-complete is actually available, rather than
           staying visible-but-disabled the way it does here on PC).
           .header-play-control hides all four here so they're never shown
           (or clickable) in both places at once. New/the sidebar toggle
           and the stats below are unaffected and stay put on every screen
           size. -->
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
        class="btn header-play-control"
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

/* Hidden on PC — .new-btn shows only the plain text label there, matching
   the original button exactly. Shown again inside the media query below. */
.new-btn-icon {
  display: none;
}

/* Keep in sync with MobilePlayBar.vue's/AutoFinishButton.vue's own
   breakpoint — all three read from the same 600px cutoff between "desktop
   header" and "mobile bottom controls" placement for Undo/Pause/Redo/Auto. */
@media (max-width: 600px) {
  .header-play-control {
    display: none;
  }

  /* MobileSidebarMenu.vue's own hamburger button (a separate,
     position: fixed component, not part of this row) takes over the
     top-left "open the menu" role at this breakpoint instead.

     .btn.sidebar-toggle.sidebar-toggle--pc (three classes, not just
     .sidebar-toggle--pc alone): style.css's own global .btn.sidebar-toggle
     rule (two classes) sets display: inline-flex at equal (0,2,0)
     specificity to a plain .sidebar-toggle--pc selector, and — since that
     global rule happens to be injected later in the final stylesheet —
     was winning the tie on source order alone, leaving this button
     visible (and, as a flex item, blockified to display: flex) instead of
     hidden. Matching all three classes here (0,3,0) wins unconditionally,
     regardless of injection order. */
  .btn.sidebar-toggle.sidebar-toggle--pc {
    display: none;
  }

  /* Stretches .actions to the header's full row width so New's own
     margin-left: auto below has somewhere to push against — without this,
     .actions would stay shrink-wrapped to just the sidebar toggle + New's
     own combined width (flex items don't grow by default), and New would
     end up sitting immediately next to the toggle instead of at the far
     right of the row. This also makes the two-row header (this row, then
     .stats below) unconditional at this breakpoint, rather than relying on
     .actions/.stats happening to overflow onto separate lines on their
     own. */
  .actions {
    width: 100%;
  }

  .new-btn {
    /* Pushes this one flex item (and it alone) to the row's right edge,
       regardless of whether the sidebar toggle before it is currently
       rendered at all (v-if) — simpler and more robust here than
       justify-content: space-between on .actions, which would re-center a
       lone remaining child instead of keeping it pinned right. */
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 44px;
    padding: 0 0.9rem;
    border-radius: 999px;
    /* Same dark green + translucency as .toolbar's own background-color,
       and the same border accent MobilePlayBar.vue/the sidebar toggle
       button already use — reads as one family of controls rather than a
       new, separately-invented style. */
    background-color: rgba(11, 61, 36, 0.85);
    border: 2px solid var(--color-sidebar-toggle-accent);
    color: var(--color-text-on-dark);
    /* Cancels .btn's shared white fill/shadow/press-down look — same
       reasoning as .btn.sidebar-toggle's own override in style.css, just
       scoped to this component instead of global since only this one
       breakpoint needs it. */
    box-shadow: none;
  }

  .new-btn:active:not(:disabled) {
    transform: none;
    box-shadow: none;
    background-image: linear-gradient(rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.12));
  }

  .new-btn-icon {
    display: inline-flex;
    width: 1.1rem;
    height: 1.1rem;
    flex: none;
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
