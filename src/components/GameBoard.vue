<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Suit } from '../domain/cards'
import { isFullyRevealed } from '../domain/autoComplete'
import type { PileRef } from '../domain/moves'
import { resolveClick, type ClickTarget } from '../domain/selection'
import { useGameStore } from '../stores/game'
import { computeCardPositions, TABLEAU_STACK_OFFSET_REM, type SlotLayout } from './boardLayout'
import CardAnimationLayer from './CardAnimationLayer.vue'
import FoundationPile from './FoundationPile.vue'
import StockPile from './StockPile.vue'
import TableauColumn from './TableauColumn.vue'
import WastePile from './WastePile.vue'

const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

const store = useGameStore()
const selection = ref<PileRef | null>(null)
const showAutoCompletePrompt = ref(false)

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

// Prompt once, right when the board newly becomes fully revealed — not on
// every re-render, and not again just because the player paused/resumed.
watch(
  () => isFullyRevealed(store.state),
  (revealed, wasRevealed) => {
    showAutoCompletePrompt.value = revealed && !wasRevealed
  },
)

function confirmAutoComplete() {
  store.autoComplete()
  showAutoCompletePrompt.value = false
}

function dismissAutoCompletePrompt() {
  showAutoCompletePrompt.value = false
}

function handleClick(target: ClickTarget) {
  if (!store.isPlayable) return

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
    <template v-if="store.state.status !== 'paused'">
      <div class="top-row">
        <div ref="stockSlotEl" class="pile-slot">
          <StockPile
            :stock-count="store.state.stock.length"
            :waste-count="store.state.waste.length"
            @click="handleClick({ type: 'stock' })"
          />
        </div>
        <div ref="wasteSlotEl" class="pile-slot">
          <WastePile
            :waste="store.state.waste"
            :selected="isSelected({ type: 'waste' })"
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
            @select="(cardIndex) => handleClick({ type: 'tableau', column: columnIndex, cardIndex })"
          />
        </div>
      </div>

      <CardAnimationLayer
        v-if="slotLayout"
        :state="store.state"
        :positions="cardPositions"
        :selected-card-ids="selectedCardIds"
      />
    </template>

    <div v-else class="pause-overlay" role="status">
      <p class="pause-title">一時停止中</p>
      <button type="button" @click="store.resume()">再開</button>
    </div>

    <div
      v-if="showAutoCompletePrompt && store.isPlayable"
      class="auto-complete-prompt"
      role="alertdialog"
      aria-label="自動で仕上げますか？"
    >
      <p class="prompt-title">自動で仕上げますか？</p>
      <div class="prompt-actions">
        <button type="button" @click="confirmAutoComplete">YES</button>
        <button type="button" @click="dismissAutoCompletePrompt">NO</button>
      </div>
    </div>

    <div v-if="store.isWon" class="win-banner" role="status">
      <p class="win-title">クリア！</p>
      <p>
        スコア: {{ store.state.score }} ／ 経過時間: {{ store.state.elapsedSeconds }}秒 ／ 手数:
        {{ store.state.moveCount }} ／ Seed: {{ store.state.seed }}
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
  background: #0f7a44;
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
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  text-align: center;
  padding: 1rem;
}

.win-title {
  font-size: 2rem;
  font-weight: bold;
  margin: 0;
}

.pause-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 20rem;
  color: #fff;
}

.pause-title {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0;
}

.auto-complete-prompt {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
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
