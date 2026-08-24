<script setup lang="ts">
import { computed } from 'vue'
import type { Card, Suit } from '../domain/cards'
import PlayingCard from './PlayingCard.vue'

const props = withDefaults(
  defineProps<{
    suit: Suit
    pile: Card[]
    selected: boolean
    /** Move-navigation hint level for this foundation as a drop target. */
    highlight?: 'none' | 'weak' | 'strong'
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
    :class="highlightClass"
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

/* Move-navigation hints: same frame/glow language as TableauColumn's. */
.nav-weak {
  box-shadow: 0 0 0 2px rgba(79, 209, 197, 0.45);
}

.nav-strong {
  box-shadow:
    0 0 0 3px rgba(79, 209, 197, 0.95),
    0 0 14px 3px rgba(79, 209, 197, 0.65);
}
</style>
