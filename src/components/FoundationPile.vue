<script setup lang="ts">
import { computed } from 'vue'
import { SUIT_NAMES, SUIT_SYMBOLS, type Card, type Suit } from '../domain/cards'
import type { CardDesign } from '../persistence/settingsStorage'
import type { HighlightLevel } from './boardLayout'
import PlayingCard from './PlayingCard.vue'

const props = withDefaults(
  defineProps<{
    suit: Suit
    pile: Card[]
    selected: boolean
    /** Move-navigation hint level for this foundation's empty-slot frame —
     * the caller only ever passes non-'none' here while the pile is empty;
     * once it holds a card, the receiving (top) card is highlighted
     * directly on CardAnimationLayer instead (the ghost card here is
     * invisible, so highlighting it wouldn't be seen). */
    highlight?: HighlightLevel
    cardDesign?: CardDesign
  }>(),
  { highlight: 'none', cardDesign: 'classic' },
)
defineEmits<{ click: [] }>()

const topCard = computed<Card | null>(() => props.pile[props.pile.length - 1] ?? null)
const suitSymbol = computed(() => SUIT_SYMBOLS[props.suit])
const highlightClass = computed(() => (props.highlight !== 'none' ? `nav-${props.highlight}` : undefined))
</script>

<template>
  <PlayingCard
    v-if="topCard"
    :card="topCard"
    :selected="selected"
    :card-design="cardDesign"
    interactive
    ghost
    @select="$emit('click')"
  />
  <button
    v-else
    type="button"
    class="empty-pile"
    :class="highlightClass"
    :data-testid="`foundation-empty-${suit}`"
    :aria-label="`${SUIT_NAMES[suit]} foundation is empty`"
    @click="$emit('click')"
  >
    <span aria-hidden="true">{{ suitSymbol }}</span>
  </button>
</template>

<style scoped>
.empty-pile {
  width: var(--card-width);
  height: var(--card-height);
  border-radius: 0.4rem;
  border: 2px dashed var(--color-outline);
  background: transparent;
  color: var(--color-empty-pile-icon);
  font-size: 1.8rem;
  padding: 0;
}
</style>
