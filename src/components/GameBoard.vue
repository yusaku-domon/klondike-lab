<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS, CARD_MOVE_ANIMATION_MS } from '../animationTiming'
import type { Suit } from '../domain/cards'
import { isFullyRevealed } from '../domain/autoComplete'
import { getLegalDestinations, getMovingCards, type PileRef } from '../domain/moves'
import { resolveClick, type ClickTarget } from '../domain/selection'
import { useGameStore } from '../stores/game'
import { useSettingsStore } from '../stores/settings'
import {
  computeCardPositions,
  computeMovedCardIds,
  exceedsDragThreshold,
  hitTestDropTarget,
  TABLEAU_STACK_OFFSET_RATIO,
  type CardPosition,
  type DestinationHighlightLevel,
  type HighlightLevel,
  type SlotLayout,
} from './boardLayout'
import CardAnimationLayer from './CardAnimationLayer.vue'
import FoundationPile from './FoundationPile.vue'
import StockPile from './StockPile.vue'
import TableauColumn from './TableauColumn.vue'
import WastePile from './WastePile.vue'

const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

const CONFETTI_COLORS = ['#ffb300', '#ff5252', '#40c4ff', '#69f0ae', '#e040fb', '#ffee58']

// Fixed, computed spread rather than Math.random() — deterministic, like
// the rest of this codebase's presentation math (e.g. computeCardPositions)
// — burst from two origins (one per cracker emoji either side of the
// title), each covering half the pieces via the alternating `side`.
const CONFETTI_PIECES = Array.from({ length: 24 }, (_, i) => {
  const side = i % 2 === 0 ? -1 : 1
  const angleDeg = 200 + ((i * 47) % 140)
  const angle = (angleDeg * Math.PI) / 180
  const distance = 60 + ((i * 29) % 60)
  const dx = Math.cos(angle) * distance * side
  const dy = Math.sin(angle) * distance + 40
  const rotate = 180 + ((i * 53) % 360)
  const delay = (i % 6) * 40

  return {
    id: i,
    style: {
      left: side < 0 ? '32%' : '68%',
      top: '22%',
      '--dx': `${dx}px`,
      '--dy': `${dy}px`,
      '--rotate': `${rotate}deg`,
      '--delay': `${delay}ms`,
      '--piece-color': CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    },
  }
})

const store = useGameStore()
const settings = useSettingsStore()
const selection = ref<PileRef | null>(null)
const showAutoCompletePrompt = ref(false)

// A fresh deal (newGame) reuses the same pile shapes as the previous game,
// so a leftover selection can otherwise keep resolving to a real-looking
// card instead of clearing — drop it whenever a new game actually starts.
watch(
  () => store.gameEpoch,
  () => {
    selection.value = null
    if (dragState.value) {
      endDrag()
      dragState.value = null
    }
  },
)

// Pointer-drag ("grab and move") state — an alternative input path to the
// click-based select/destination flow above, not a replacement: a
// pointerdown that never moves past DRAG_THRESHOLD_PX is left alone so the
// native click that follows it still drives the existing two-step
// selection exactly as before. Only once movement crosses that threshold
// does this take over, at which point it clears any click-based
// `selection` so the two input methods can't both be "active" at once.
interface DragState {
  from: PileRef
  cardIds: string[]
  pointerId: number
  startX: number
  startY: number
  dx: number
  dy: number
  startedDrag: boolean
}

const dragState = ref<DragState | null>(null)
// Set for exactly one tick after a real drag ends, so the click event the
// browser still fires right after that pointerup doesn't also re-toggle
// selection on whatever the finger happened to land on.
let suppressNextClick = false

// Comfortably above CardAnimationLayer's own ANIMATING_Z_OFFSET (1000) so a
// dragged card always wins even in the split second where a drop also
// marks it as "animating" into its new resting spot.
const DRAGGING_Z_OFFSET = 2000

function endDrag() {
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
  window.removeEventListener('pointercancel', handlePointerCancel)
}

function handleDragStart(from: PileRef, event: PointerEvent) {
  // event.button is 0 for touch/pen contact and a primary-button mouse
  // press; a right- or middle-click shouldn't start a drag (or fight the
  // browser's own context menu on release).
  if (!store.isPlayable || store.isAnimating || dragState.value || event.button !== 0) return
  const movingCards = getMovingCards(store.state, from)
  if (!movingCards) return

  dragState.value = {
    from,
    cardIds: movingCards.map((card) => card.id),
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    dx: 0,
    dy: 0,
    startedDrag: false,
  }

  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('pointercancel', handlePointerCancel)
}

function handlePointerMove(event: PointerEvent) {
  const drag = dragState.value
  if (!drag || event.pointerId !== drag.pointerId) return

  const dx = event.clientX - drag.startX
  const dy = event.clientY - drag.startY

  if (!drag.startedDrag && exceedsDragThreshold(dx, dy)) {
    selection.value = null
    dragState.value = { ...drag, dx, dy, startedDrag: true }
    return
  }

  dragState.value = { ...drag, dx, dy }
}

function handlePointerUp(event: PointerEvent) {
  const drag = dragState.value
  if (!drag || event.pointerId !== drag.pointerId) return
  endDrag()

  if (!drag.startedDrag) {
    // Movement never crossed the threshold — this was a tap, not a drag.
    // Clear our own state and let the click event still coming handle
    // selection, unchanged from before this feature existed.
    dragState.value = null
    return
  }

  // Only the click event this SAME gesture is about to fire should be
  // suppressed. A drop over background with no click handler at all (the
  // top-row spacer, board padding) would otherwise leave this flag set
  // indefinitely, silently swallowing some future, unrelated click —
  // queueMicrotask clears it right after that immediate click has had its
  // chance to run, whether or not anything actually consumed it.
  suppressNextClick = true
  queueMicrotask(() => {
    suppressNextClick = false
  })
  const boardRect = boardEl.value?.getBoundingClientRect()
  const to =
    boardRect && slotLayout.value
      ? hitTestDropTarget(
          { x: event.clientX - boardRect.left, y: event.clientY - boardRect.top },
          slotLayout.value,
          cardWidthPx.value,
          cardHeightPx.value,
        )
      : null

  dragState.value = null
  // store.move safely no-ops (returns false, no state change) for a
  // geometrically-hit but rules-illegal destination — same guarantee
  // click-based moves already rely on — so the dropped card's visual
  // position simply falls back to its unchanged pile slot, which reads as
  // a "snap back" for free via the same CSS transition normal moves use.
  if (to && store.isPlayable && !store.isAnimating) {
    store.move({ from: drag.from, to })
  }
}

function handlePointerCancel(event: PointerEvent) {
  const drag = dragState.value
  if (!drag || event.pointerId !== drag.pointerId) return
  endDrag()
  dragState.value = null
}

// Live-measured slot positions, not fixed rem math: the top-row uses a
// flexible spacer to push foundations to the right edge, so their real
// on-screen position depends on the viewport width and must come from the
// actual DOM rather than an assumption about the CSS layout.
const boardEl = ref<HTMLElement | null>(null)
const stockSlotEl = ref<HTMLElement | null>(null)
const wasteSlotEl = ref<HTMLElement | null>(null)
const foundationSlotEls: Partial<Record<Suit, HTMLElement>> = {}
const tableauSlotEls: (HTMLElement | undefined)[] = []

function setFoundationSlotEl(suit: Suit, el: Element | null) {
  if (el instanceof HTMLElement) foundationSlotEls[suit] = el
}

function setTableauSlotEl(index: number, el: Element | null) {
  if (el instanceof HTMLElement) tableauSlotEls[index] = el
}

const slotLayout = ref<SlotLayout | null>(null)
const stackOffsetPx = ref(0)
// Real rendered card box size in px — needed (alongside slotLayout) to
// hit-test where a drag was dropped, since --card-width/--card-height are a
// responsive clamp() (see style.css), not a fixed rem convertible with a
// single root-font-size constant.
const cardWidthPx = ref(0)
const cardHeightPx = ref(0)

function measureSlots() {
  const boardRect = boardEl.value?.getBoundingClientRect()
  if (!boardRect || !stockSlotEl.value || !wasteSlotEl.value) return
  if (tableauSlotEls.length < 7 || tableauSlotEls.some((el) => !el)) return
  if (SUITS.some((suit) => !foundationSlotEls[suit])) return

  const relative = (el: HTMLElement): { x: number; y: number } => {
    const rect = el.getBoundingClientRect()
    return { x: rect.left - boardRect.left, y: rect.top - boardRect.top }
  }

  slotLayout.value = {
    stock: relative(stockSlotEl.value),
    waste: relative(wasteSlotEl.value),
    foundations: {
      clubs: relative(foundationSlotEls.clubs!),
      diamonds: relative(foundationSlotEls.diamonds!),
      hearts: relative(foundationSlotEls.hearts!),
      spades: relative(foundationSlotEls.spades!),
    },
    tableau: tableauSlotEls.map((el) => relative(el!)),
  }

  const cardRect = stockSlotEl.value.getBoundingClientRect()
  cardWidthPx.value = cardRect.width
  cardHeightPx.value = cardRect.height
  stackOffsetPx.value = cardRect.height * TABLEAU_STACK_OFFSET_RATIO
}

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  await nextTick()
  measureSlots()

  if (typeof ResizeObserver !== 'undefined' && boardEl.value) {
    resizeObserver = new ResizeObserver(() => measureSlots())
    resizeObserver.observe(boardEl.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (dragState.value) endDrag()
})

const cardPositions = computed(() => {
  if (!slotLayout.value) return new Map()
  return computeCardPositions(store.state, slotLayout.value, stackOffsetPx.value)
})

const draggingCardIds = computed<ReadonlySet<string>>(() =>
  dragState.value?.startedDrag ? new Set(dragState.value.cardIds) : new Set(),
)

// What CardAnimationLayer actually renders: cardPositions above, with the
// currently-dragged card(s) overridden to follow the pointer instead of
// sitting at their (unchanged, since state hasn't moved yet) pile slot.
// Dropping clears dragState, so this falls straight back to cardPositions —
// which, combined with CardAnimationLayer's normal transition, is what
// makes an illegal or missed drop "snap back" without any extra code.
const displayedCardPositions = computed<Map<string, CardPosition>>(() => {
  const drag = dragState.value
  if (!drag?.startedDrag) return cardPositions.value

  const overridden = new Map(cardPositions.value)
  for (const id of drag.cardIds) {
    const pos = overridden.get(id)
    if (!pos) continue
    overridden.set(id, { x: pos.x + drag.dx, y: pos.y + drag.dy, z: pos.z + DRAGGING_Z_OFFSET })
  }
  return overridden
})

// Auto-complete cascade steps animate faster than a manual move; every
// place that needs "how long is this move's transition" reads this instead
// of the constants directly, so the two never fall out of sync with each
// other for a given state change.
const cardAnimationDurationMs = computed(() =>
  store.isAutoCompleting ? AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS : CARD_MOVE_ANIMATION_MS,
)

// Cards that just relocated (pile and/or index changed) get bumped above
// the rest of the layer for the duration of the move's CSS transition, so
// they never visually dip behind another pile while sliding across it.
// Pure diff of before/after state — doesn't know or care what kind of
// action caused the change, so it can't affect move legality, scoring,
// undo, or persistence.
const animatingCardIds = ref<ReadonlySet<string>>(new Set())
let animatingCardsTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => store.state,
  (next, previous) => {
    if (!previous) return
    const moved = computeMovedCardIds(previous, next)
    if (moved.size === 0) return

    animatingCardIds.value = moved
    if (animatingCardsTimer !== null) clearTimeout(animatingCardsTimer)
    animatingCardsTimer = setTimeout(() => {
      animatingCardsTimer = null
      animatingCardIds.value = new Set()
    }, cardAnimationDurationMs.value)
  },
)

onBeforeUnmount(() => {
  if (animatingCardsTimer !== null) clearTimeout(animatingCardsTimer)
})

// Move navigation: highlights only the current selection's legal
// destinations, reusing getLegalDestinations (itself built on the same
// canPlaceOnTableau/canPlaceOnFoundation checks applyMove uses) — never an
// independent judgment of legality, and never a suggestion of the "best"
// move. A single destination is shown stronger than several.
//
// The receiving card itself is highlighted, not the whole column: an empty
// pile has no card to highlight, so that case still gets a frame on its own
// empty-slot button (tableauHighlight/foundationHighlight below); a pile
// that already holds cards gets its top card highlighted instead, via
// destinationCardHighlights — CardAnimationLayer, not the (invisible,
// opacity:0) ghost card underneath, is what the player actually sees, so
// that's where this has to be applied to be visible at all.
const legalDestinations = computed<PileRef[]>(() => {
  // An in-progress drag always shows its legal destinations — this is the
  // drag's own direct feedback, not the optional click-based hint the
  // moveNavigationEnabled setting gates below.
  if (dragState.value?.startedDrag) {
    return getLegalDestinations(store.state, dragState.value.from)
  }
  if (!settings.moveNavigationEnabled || !selection.value) return []
  return getLegalDestinations(store.state, selection.value)
})

function highlightLevelFor(predicate: (destination: PileRef) => boolean): HighlightLevel {
  const destinations = legalDestinations.value
  if (!destinations.some(predicate)) return 'none'
  return destinations.length === 1 ? 'strong' : 'weak'
}

// Empty-slot frame only — 'none' whenever the pile already has a card, since
// that case is handled by destinationCardHighlights instead.
function tableauHighlight(columnIndex: number): HighlightLevel {
  if ((store.state.tableau[columnIndex]?.length ?? 0) > 0) return 'none'
  return highlightLevelFor((d) => d.type === 'tableau' && d.column === columnIndex)
}

function foundationHighlight(suit: Suit): HighlightLevel {
  if (store.state.foundations[suit].length > 0) return 'none'
  return highlightLevelFor((d) => d.type === 'foundation' && d.suit === suit)
}

const destinationCardHighlights = computed<ReadonlyMap<string, DestinationHighlightLevel>>(() => {
  const destinations = legalDestinations.value
  const level: DestinationHighlightLevel = destinations.length === 1 ? 'strong' : 'weak'
  const map = new Map<string, DestinationHighlightLevel>()

  for (const destination of destinations) {
    if (destination.type === 'tableau') {
      const column = store.state.tableau[destination.column]
      const top = column?.[column.length - 1]
      if (top) map.set(top.id, level)
    } else if (destination.type === 'foundation') {
      const pile = store.state.foundations[destination.suit]
      const top = pile[pile.length - 1]
      if (top) map.set(top.id, level)
    }
  }

  return map
})

// Prompt once, right when the board newly becomes fully revealed — not on
// every re-render, and not again just because the player paused/resumed.
// `immediate: true` also covers a game restored from localStorage that was
// *already* fully revealed the moment it loads (e.g. the player quit right
// after revealing the last card): without it, a lazy watch only fires on a
// false→true transition, and there is no such transition to observe here —
// the board is revealed from its very first tick, so the prompt would
// otherwise never appear even though the manual button is already enabled.
// On the immediate call `wasRevealed` is `undefined`, so `!wasRevealed` is
// `true` and this correctly reduces to just `revealed`.
watch(
  () => isFullyRevealed(store.state),
  (revealed, wasRevealed) => {
    showAutoCompletePrompt.value = revealed && !wasRevealed
  },
  { immediate: true },
)

function confirmAutoComplete() {
  if (store.isAnimating) return
  store.autoComplete()
  showAutoCompletePrompt.value = false
}

function dismissAutoCompletePrompt() {
  showAutoCompletePrompt.value = false
}

function handleClick(target: ClickTarget) {
  // The click that the browser fires right after a real drag's pointerup —
  // suppressed so it can't also toggle selection on whatever the finger
  // happened to land on.
  if (suppressNextClick) {
    suppressNextClick = false
    return
  }
  if (!store.isPlayable || store.isAnimating) return

  if (target.type === 'stock') {
    store.clickStock()
    return
  }

  selection.value = resolveClick(store.state, selection.value, target, store.move)
}

function isSelected(target: ClickTarget): boolean {
  const s = selection.value
  if (!s) return false
  if (s.type === 'waste' && target.type === 'waste') return true
  if (s.type === 'foundation' && target.type === 'foundation') return s.suit === target.suit
  return false
}

function tableauSelectedFromIndex(columnIndex: number): number | null {
  const s = selection.value
  if (!s || s.type !== 'tableau' || s.column !== columnIndex) return null
  return s.cardIndex ?? null
}

const selectedCardIds = computed<ReadonlySet<string>>(() => {
  const s = selection.value
  if (!s) return new Set()

  if (s.type === 'waste') {
    const top = store.state.waste[store.state.waste.length - 1]
    return top ? new Set([top.id]) : new Set()
  }

  if (s.type === 'foundation') {
    const pile = store.state.foundations[s.suit]
    const top = pile[pile.length - 1]
    return top ? new Set([top.id]) : new Set()
  }

  if (s.type === 'tableau') {
    const column = store.state.tableau[s.column] ?? []
    return new Set(column.slice(s.cardIndex ?? 0).map((card) => card.id))
  }

  return new Set()
})
</script>

<template>
  <div ref="boardEl" class="game-board">
    <div class="top-row">
      <div ref="stockSlotEl" class="pile-slot">
        <StockPile
          :stock-count="store.state.stock.length"
          :waste-count="store.state.waste.length"
          :card-design="settings.cardDesign"
          @click="handleClick({ type: 'stock' })"
        />
      </div>
      <div ref="wasteSlotEl" class="pile-slot">
        <WastePile
          :waste="store.state.waste"
          :selected="isSelected({ type: 'waste' })"
          :card-design="settings.cardDesign"
          @click="handleClick({ type: 'waste' })"
          @dragstart="(event) => handleDragStart({ type: 'waste' }, event)"
        />
      </div>
      <div class="spacer" />
      <div
        v-for="suit in SUITS"
        :key="suit"
        class="pile-slot"
        :ref="(el) => setFoundationSlotEl(suit, el as Element | null)"
      >
        <FoundationPile
          :suit="suit"
          :pile="store.state.foundations[suit]"
          :selected="isSelected({ type: 'foundation', suit })"
          :highlight="foundationHighlight(suit)"
          :card-design="settings.cardDesign"
          @click="handleClick({ type: 'foundation', suit })"
          @dragstart="(event) => handleDragStart({ type: 'foundation', suit }, event)"
        />
      </div>
    </div>

    <div class="tableau-row">
      <div
        v-for="(column, columnIndex) in store.state.tableau"
        :key="columnIndex"
        class="pile-slot"
        :ref="(el) => setTableauSlotEl(columnIndex, el as Element | null)"
      >
        <TableauColumn
          :column="column"
          :column-index="columnIndex"
          :selected-from-index="tableauSelectedFromIndex(columnIndex)"
          :highlight="tableauHighlight(columnIndex)"
          :card-design="settings.cardDesign"
          @select="(cardIndex) => handleClick({ type: 'tableau', column: columnIndex, cardIndex })"
          @dragstart="
            (cardIndex, event) => handleDragStart({ type: 'tableau', column: columnIndex, cardIndex }, event)
          "
        />
      </div>
    </div>

    <CardAnimationLayer
      v-if="slotLayout"
      :state="store.state"
      :positions="displayedCardPositions"
      :selected-card-ids="selectedCardIds"
      :animating-card-ids="animatingCardIds"
      :dragging-card-ids="draggingCardIds"
      :destination-highlights="destinationCardHighlights"
      :animation-duration-ms="cardAnimationDurationMs"
      :card-design="settings.cardDesign"
    />

    <!-- Grays out the board in place rather than replacing it, so the
         player sees exactly the layout they paused on — matching
         .win-banner/.auto-complete-prompt's same overlay-on-top pattern
         below, never shown together since 'paused' is mutually exclusive
         with 'won' and with isPlayable. -->
    <div v-if="store.state.status === 'paused'" class="pause-overlay" role="status">
      <p class="pause-title">Paused</p>
      <button type="button" class="btn" @click="store.resume()">Resume</button>
    </div>

    <div
      v-if="showAutoCompletePrompt && store.isPlayable"
      class="auto-complete-prompt"
      role="alertdialog"
      aria-label="Auto-complete the game?"
    >
      <p class="prompt-title">Auto-complete the game?</p>
      <div class="prompt-actions">
        <button type="button" class="btn" @click="confirmAutoComplete">YES</button>
        <button type="button" class="btn" @click="dismissAutoCompletePrompt">NO</button>
      </div>
    </div>

    <div v-if="store.isWon" class="win-banner" role="status">
      <span
        v-for="piece in CONFETTI_PIECES"
        :key="piece.id"
        class="confetti-piece"
        :style="piece.style"
        aria-hidden="true"
      />
      <div class="win-title-row">
        <span class="cracker" aria-hidden="true">🎉</span>
        <p class="win-title">You Win!</p>
        <span class="cracker" aria-hidden="true">🎉</span>
      </div>
      <p>
        Score: {{ store.state.score }} / Time: {{ store.state.elapsedSeconds }}s / Moves:
        {{ store.state.moveCount }} / Seed: {{ store.state.seed }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.game-board {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2rem;
  /* Kept as 1/3 of --card-width (matching --card-width's own clamp() math
     in style.css) rather than a fixed rem, so the board's edge margin
     shrinks in step with the cards instead of eating into the width the
     7-column fit calculation already accounts for. */
  padding: calc(var(--card-width) / 3);
  background: var(--color-felt);
  box-sizing: border-box;
}

.top-row {
  display: flex;
  gap: calc(var(--card-width) / 6);
}

.spacer {
  flex: 1;
}

.pile-slot {
  display: flex;
}

.tableau-row {
  display: flex;
  gap: calc(var(--card-width) / 6);
}

.win-banner {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.75);
  color: var(--color-text-on-dark);
  text-align: center;
  padding: 1rem;
}

.win-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.cracker {
  font-size: 1.75rem;
}

.win-title {
  font-family: 'Press Start 2P', monospace;
  /* Press Start 2P ships one weight only — font-weight: bold here would
     just have the browser synthesize a fake bold, which smears a pixel
     font's blocky strokes instead of thickening them cleanly. */
  font-weight: 400;
  font-size: 1.25rem;
  letter-spacing: 0.1em;
  margin: 0;
}

.confetti-piece {
  position: absolute;
  width: 8px;
  height: 14px;
  background: var(--piece-color);
  animation: confetti-burst 900ms ease-out var(--delay, 0ms) both;
  pointer-events: none;
}

@keyframes confetti-burst {
  0% {
    transform: translate(0, 0) rotate(0deg);
    opacity: 1;
  }
  30% {
    transform: translate(calc(var(--dx) * 0.6), calc(var(--dy) * 0.3 - 20px))
      rotate(calc(var(--rotate) * 0.5));
    opacity: 1;
  }
  100% {
    transform: translate(var(--dx), var(--dy)) rotate(var(--rotate));
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .confetti-piece {
    animation: none;
    opacity: 0;
  }
}

.pause-overlay {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: rgba(0, 0, 0, 0.75);
  color: var(--color-text-on-dark);
  text-align: center;
  padding: 1rem;
}

.pause-title {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0;
}

.auto-complete-prompt {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
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
