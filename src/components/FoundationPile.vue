<script setup lang="ts">
import { computed } from 'vue'
import type { Card, Suit } from '../domain/cards'
import PlayingCard from './PlayingCard.vue'

const props = defineProps<{ suit: Suit; pile: Card[]; selected: boolean }>()
defineEmits<{ click: [] }>()

const SUIT_SYMBOLS: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const SUIT_NAMES: Record<Suit, string> = { clubs: 'クラブ', diamonds: 'ダイヤ', hearts: 'ハート', spades: 'スペード' }

const topCard = computed<Card | null>(() => props.pile[props.pile.length - 1] ?? null)
const suitSymbol = computed(() => SUIT_SYMBOLS[props.suit])
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
