<script setup lang="ts">
import { computed } from 'vue'
import { getCardColor, SUIT_NAMES, SUIT_SYMBOLS, type Card } from '../domain/cards'
import type { CardDesign } from '../persistence/settingsStorage'
import SvgCardFace from './SvgCardFace.vue'

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
    /** Which face artwork to render — passed down from GameBoard (which
     * reads the settings store) rather than read from the store directly
     * here, so this component stays a pure, store-free presentational
     * piece usable from any context (including tests that never set up
     * Pinia at all). */
    cardDesign?: CardDesign
  }>(),
  { selected: false, interactive: false, ghost: false, decorative: false, cardDesign: 'classic' },
)

defineEmits<{ select: [] }>()

const RANK_LABELS: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }

const rankLabel = computed(() => RANK_LABELS[props.card.rank] ?? String(props.card.rank))
const suitSymbol = computed(() => SUIT_SYMBOLS[props.card.suit])
const colorClass = computed(() => (getCardColor(props.card.suit) === 'red' ? 'red' : 'black'))

const ariaLabel = computed(() => {
  if (!props.card.faceUp) return 'Face-down card'
  const base = `${rankLabel.value} of ${SUIT_NAMES[props.card.suit]}`
  return props.selected ? `${base}, selected` : base
})
</script>

<template>
  <component
    :is="interactive ? 'button' : 'div'"
    :type="interactive ? 'button' : undefined"
    class="playing-card"
    :class="[
      card.faceUp ? colorClass : 'face-down',
      { selected, interactive, ghost, 'image-backed': cardDesign !== 'classic' },
    ]"
    :data-testid="decorative ? undefined : `card-${card.id}`"
    :aria-pressed="interactive ? selected : undefined"
    :aria-label="ariaLabel"
    @click="interactive && $emit('select')"
  >
    <template v-if="cardDesign === 'classic'">
      <template v-if="card.faceUp">
        <span class="corner top" aria-hidden="true">{{ rankLabel }}{{ suitSymbol }}</span>
        <span class="suit-symbol-large" aria-hidden="true">{{ suitSymbol }}</span>
        <span class="corner bottom" aria-hidden="true">{{ rankLabel }}{{ suitSymbol }}</span>
      </template>
    </template>

    <SvgCardFace v-else :deck="cardDesign" :card="card" />
  </component>
</template>

<style scoped>
.playing-card {
  width: var(--card-width);
  height: var(--card-height);
  border-radius: 0.4rem;
  border: 1px solid var(--color-card-border);
  background: var(--color-text-on-dark);
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
  background: var(--card-back-pattern);
}

.playing-card.image-backed {
  border: none;
  background: transparent;
  padding: 0;
}

.playing-card.red {
  color: var(--color-suit-red);
}

.playing-card.black {
  color: var(--color-suit-black);
}

.playing-card.interactive {
  cursor: pointer;
}

.playing-card.selected {
  outline: 3px solid var(--color-selected);
  outline-offset: 2px;
  transform: translateY(-6px);
}

.playing-card.ghost {
  opacity: 0;
}

.corner {
  /* 1rem at the 4.5rem desktop --card-width (see style.css) — proportional
     so text keeps the same relative size as the card shrinks on narrow
     viewports instead of overflowing a smaller box. */
  font-size: calc(var(--card-width) * 2 / 9);
  line-height: 1;
  font-weight: bold;
}

.corner.bottom {
  align-self: flex-end;
  transform: rotate(180deg);
}

.suit-symbol-large {
  /* 1.8rem at the 4.5rem desktop --card-width — see .corner above. */
  font-size: calc(var(--card-width) * 2 / 5);
  text-align: center;
}
</style>
