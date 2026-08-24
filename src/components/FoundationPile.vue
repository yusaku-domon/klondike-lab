<script setup lang="ts">
import { computed } from 'vue'
import type { Card, Suit } from '../domain/cards'
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
  }>(),
  { highlight: 'none' },
)
defineEmits<{ click: [] }>()

const SUIT_SYMBOLS: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const SUIT_NAMES: Record<Suit, string> = { clubs: 'クラブ', diamonds: 'ダイヤ', hearts: 'ハート', spades: 'スペード' }

const topCard = computed<Card | null>(() => props.pile[props.pile.length - 1] ?? null)
const suitSymbol = computed(() => SUIT_SYMBOLS[props.suit])
const highlightClass = computed(() => (props.highlight !== 'none' ? `nav-${props.highlight}` : undefined))
</script>

<template>
  <PlayingCard
    v-if="topCard"
    :card="topCard"
    :selected="selected"
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
    :aria-label="`${SUIT_NAMES[suit]}の組札は空です`"
    @click="$emit('click')"
  >
    <span aria-hidden="true">{{ suitSymbol }}</span>
  </button>
</template>

<style scoped>
.empty-pile {
  width: 4.5rem;
  height: 6.5rem;
  border-radius: 0.4rem;
  border: 2px dashed #7fbf9e;
  background: transparent;
  color: #cfe9db;
  font-size: 1.8rem;
  padding: 0;
}
</style>
