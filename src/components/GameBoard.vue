<script setup lang="ts">
import { ref } from 'vue'
import type { Suit } from '../domain/cards'
import type { PileRef } from '../domain/moves'
import { resolveClick, type ClickTarget } from '../domain/selection'
import { useGameStore } from '../stores/game'
import FoundationPile from './FoundationPile.vue'
import StockPile from './StockPile.vue'
import TableauColumn from './TableauColumn.vue'
import WastePile from './WastePile.vue'

const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

const store = useGameStore()
const selection = ref<PileRef | null>(null)

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
</script>

<template>
  <div class="game-board">
    <div class="top-row">
      <StockPile
        :stock-count="store.state.stock.length"
        :waste-count="store.state.waste.length"
        @click="handleClick({ type: 'stock' })"
      />
      <WastePile
        :waste="store.state.waste"
        :selected="isSelected({ type: 'waste' })"
        @click="handleClick({ type: 'waste' })"
      />
      <div class="spacer" />
      <FoundationPile
        v-for="suit in SUITS"
        :key="suit"
        :suit="suit"
        :pile="store.state.foundations[suit]"
        :selected="isSelected({ type: 'foundation', suit })"
        @click="handleClick({ type: 'foundation', suit })"
      />
    </div>

    <div class="tableau-row">
      <TableauColumn
        v-for="(column, columnIndex) in store.state.tableau"
        :key="columnIndex"
        :column="column"
        :column-index="columnIndex"
        :selected-from-index="tableauSelectedFromIndex(columnIndex)"
        @select="(cardIndex) => handleClick({ type: 'tableau', column: columnIndex, cardIndex })"
      />
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
  flex-direction: column;
  gap: 2rem;
  padding: 1.5rem;
  background: #0f7a44;
  min-height: 100%;
  box-sizing: border-box;
}

.top-row {
  display: flex;
  gap: 0.75rem;
}

.spacer {
  flex: 1;
}

.tableau-row {
  display: flex;
  gap: 0.75rem;
}

.win-banner {
  position: absolute;
  inset: 0;
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
</style>
