<script setup lang="ts">
import { computed } from 'vue'
import { getCardColor, type Card, type Suit } from '../domain/cards'

const props = withDefaults(
  defineProps<{
    card: Card
    selected?: boolean
    interactive?: boolean
    /**
     * Renders fully transparent while keeping size, hit-testing, and ARIA
     * semantics intact. Used for the real interactive card underneath the
     * decorative CardAnimationLayer, which shows the actual moving visual.
     */
    ghost?: boolean
    /**
     * Purely visual copy (used by CardAnimationLayer): skips data-testid so
     * it never collides with the real interactive element's, on top of
     * living inside an aria-hidden layer.
     */
    decorative?: boolean
  }>(),
  { selected: false, interactive: false, ghost: false, decorative: false },
)

defineEmits<{ select: [] }>()

const RANK_LABELS: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }
const SUIT_SYMBOLS: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const SUIT_NAMES: Record<Suit, string> = { clubs: 'クラブ', diamonds: 'ダイヤ', hearts: 'ハート', spades: 'スペード' }

const rankLabel = computed(() => RANK_LABELS[props.card.rank] ?? String(props.card.rank))
const suitSymbol = computed(() => SUIT_SYMBOLS[props.card.suit])
const colorClass = computed(() => (getCardColor(props.card.suit) === 'red' ? 'red' : 'black'))

const ariaLabel = computed(() => {
  if (!props.card.faceUp) return '裏向きのカード'
  const base = `${SUIT_NAMES[props.card.suit]}の${rankLabel.value}`
  return props.selected ? `${base}、選択中` : base
})
</script>

<template>
  <component
    :is="interactive ? 'button' : 'div'"
    :type="interactive ? 'button' : undefined"
    class="playing-card"
    :class="[card.faceUp ? colorClass : 'face-down', { selected, interactive, ghost }]"
    :data-testid="decorative ? undefined : `card-${card.id}`"
    :aria-pressed="interactive ? selected : undefined"
    :aria-label="ariaLabel"
    @click="interactive && $emit('select')"
  >
    <template v-if="card.faceUp">
      <span class="corner top" aria-hidden="true">{{ rankLabel }}{{ suitSymbol }}</span>
      <span class="suit-symbol-large" aria-hidden="true">{{ suitSymbol }}</span>
      <span class="corner bottom" aria-hidden="true">{{ rankLabel }}{{ suitSymbol }}</span>
    </template>
  </component>
</template>

<style scoped>
.playing-card {
  width: 4.5rem;
  height: 6.5rem;
  border-radius: 0.4rem;
  border: 1px solid #333;
  background: #fff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0.25rem;
  font-family: Georgia, serif;
  box-sizing: border-box;
  position: relative;
  margin: 0;
}

.playing-card.face-down {
  background: repeating-linear-gradient(45deg, #2a5fa5, #2a5fa5 4px, #1c4780 4px, #1c4780 8px);
}

.playing-card.red {
  color: #b00020;
}

.playing-card.black {
  color: #111;
}

.playing-card.interactive {
  cursor: pointer;
}

.playing-card.selected {
  outline: 3px solid #ffb300;
  outline-offset: 2px;
  transform: translateY(-6px);
}

.playing-card.ghost {
  opacity: 0;
}

.corner {
  font-size: 1rem;
  line-height: 1;
  font-weight: bold;
}

.corner.bottom {
  align-self: flex-end;
  transform: rotate(180deg);
}

.suit-symbol-large {
  font-size: 1.8rem;
  text-align: center;
}
</style>
