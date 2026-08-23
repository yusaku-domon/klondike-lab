<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '../domain/cards'
import type { GameState } from '../domain/deal'
import type { CardPosition } from './boardLayout'
import PlayingCard from './PlayingCard.vue'

const props = defineProps<{
  state: GameState
  positions: Map<string, CardPosition>
  selectedCardIds: ReadonlySet<string>
}>()

const allCards = computed<Card[]>(() => [
  ...props.state.stock,
  ...props.state.waste,
  ...props.state.tableau.flat(),
  ...Object.values(props.state.foundations).flat(),
])
</script>

<template>
  <div class="card-animation-layer" aria-hidden="true">
    <div
      v-for="card in allCards"
      :key="card.id"
      class="card-wrapper"
      :style="{
        transform: `translate(${positions.get(card.id)?.x ?? 0}px, ${positions.get(card.id)?.y ?? 0}px)`,
        zIndex: positions.get(card.id)?.z ?? 0,
      }"
    >
      <PlayingCard :card="card" :selected="selectedCardIds.has(card.id)" decorative />
    </div>
  </div>
</template>

<style scoped>
.card-animation-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.card-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}
</style>
