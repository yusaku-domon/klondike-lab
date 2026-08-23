<script setup lang="ts">
import { computed } from 'vue'
import { CARD_MOVE_ANIMATION_MS } from '../animationTiming'
import { createCardId, RANKS, SUITS, type Card } from '../domain/cards'
import type { GameState } from '../domain/deal'
import type { CardPosition } from './boardLayout'
import PlayingCard from './PlayingCard.vue'

const props = defineProps<{
  state: GameState
  positions: Map<string, CardPosition>
  selectedCardIds: ReadonlySet<string>
}>()

// Fixed render order (never re-derived from which pile a card is
// currently in) so a card moving piles never reorders its DOM node.
// Reordering nodes and changing `transform` in the same patch is what was
// making the CSS transition silently skip on the 2nd+ move: Vue would
// move the element via insertBefore at the same time its style changed,
// and browsers don't reliably animate a property change that lands in the
// same style recalc as a DOM reinsertion.
const CANONICAL_CARD_ORDER: string[] = SUITS.flatMap((suit) =>
  RANKS.map((rank) => createCardId(suit, rank)),
)

const cardsById = computed<Map<string, Card>>(() => {
  const map = new Map<string, Card>()
  for (const card of props.state.stock) map.set(card.id, card)
  for (const card of props.state.waste) map.set(card.id, card)
  for (const column of props.state.tableau) {
    for (const card of column) map.set(card.id, card)
  }
  for (const suit of SUITS) {
    for (const card of props.state.foundations[suit]) map.set(card.id, card)
  }
  return map
})
</script>

<template>
  <div class="card-animation-layer" aria-hidden="true">
    <div
      v-for="id in CANONICAL_CARD_ORDER"
      :key="id"
      class="card-wrapper"
      :style="{
        transform: `translate(${positions.get(id)?.x ?? 0}px, ${positions.get(id)?.y ?? 0}px)`,
        zIndex: positions.get(id)?.z ?? 0,
        transitionDuration: `${CARD_MOVE_ANIMATION_MS}ms`,
      }"
    >
      <PlayingCard
        v-if="cardsById.get(id)"
        :card="cardsById.get(id)!"
        :selected="selectedCardIds.has(id)"
        decorative
      />
    </div>
  </div>
</template>

<style scoped>
.card-animation-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  /*
   * Establishes a stacking context so the per-card z-index values below
   * (0..N, based on position within a pile) are contained here and never
   * escape to compete with siblings like .win-banner/.auto-complete-prompt
   * in the parent .game-board — without this, any card past the very
   * bottom of a pile (z-index > 0) would paint above an overlay that only
   * has the default z-index: auto.
   */
  z-index: 1;
}

.card-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  /* Duration comes from the inline style (CARD_MOVE_ANIMATION_MS) so the
     store's input-lock timeout can never drift out of sync with it. */
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}
</style>
