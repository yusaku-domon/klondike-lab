<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS, CARD_MOVE_ANIMATION_MS } from '../animationTiming'
import type { Suit } from '../domain/cards'
import { isFullyRevealed } from '../domain/autoComplete'
import { getLegalDestinations, type PileRef } from '../domain/moves'
import { resolveClick, type ClickTarget } from '../domain/selection'
import { useGameStore } from '../stores/game'
import { useSettingsStore } from '../stores/settings'
import {
  computeCardPositions,
  computeMovedCardIds,
  TABLEAU_STACK_OFFSET_REM,
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
  },
)

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

  const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  stackOffsetPx.value = TABLEAU_STACK_OFFSET_REM * remPx
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
})

const cardPositions = computed(() => {
  if (!slotLayout.value) return new Map()
  return computeCardPositions(store.state, slotLayout.value, stackOffsetPx.value)
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
        />
      </div>
    </div>

    <CardAnimationLayer
      v-if="slotLayout"
      :state="store.state"
      :positions="cardPositions"
      :selected-card-ids="selectedCardIds"
      :animating-card-ids="animatingCardIds"
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
      <p class="win-title">You Win!</p>
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
  padding: 1.5rem;
  background: var(--color-felt);
  box-sizing: border-box;
}

.top-row {
  display: flex;
  gap: 0.75rem;
}

.spacer {
  flex: 1;
}

.pile-slot {
  display: flex;
}

.tableau-row {
  display: flex;
  gap: 0.75rem;
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

.win-title {
  font-size: 2rem;
  font-weight: bold;
  margin: 0;
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
