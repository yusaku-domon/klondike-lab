<script setup lang="ts">
import { computed } from 'vue'
import { getCardColor, SUIT_NAMES, SUIT_SYMBOLS, type Card } from '../domain/cards'
import { PIP_LAYOUTS } from './cardPipLayout'

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

const rankLabel = computed(() => RANK_LABELS[props.card.rank] ?? String(props.card.rank))
const suitSymbol = computed(() => SUIT_SYMBOLS[props.card.suit])
const colorClass = computed(() => (getCardColor(props.card.suit) === 'red' ? 'red' : 'black'))
// Only ranks 2-10 have a pip layout; Ace keeps its single big centered
// symbol, and face cards (J/Q/K) get the letter+flanking-symbols treatment
// below — neither looks at this.
const pipLayout = computed(() => PIP_LAYOUTS[props.card.rank])
const isFaceCard = computed(() => props.card.rank >= 11)

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
    :class="[card.faceUp ? colorClass : 'face-down', { selected, interactive, ghost }]"
    :data-testid="decorative ? undefined : `card-${card.id}`"
    :aria-pressed="interactive ? selected : undefined"
    :aria-label="ariaLabel"
    @click="interactive && $emit('select')"
  >
    <template v-if="card.faceUp">
      <span class="corner top" aria-hidden="true">{{ rankLabel }}{{ suitSymbol }}</span>

      <span v-if="card.rank === 1" class="suit-symbol-large" aria-hidden="true">{{ suitSymbol }}</span>

      <div v-else-if="pipLayout" class="pip-grid" aria-hidden="true">
        <span
          v-for="(pip, index) in pipLayout"
          :key="index"
          class="pip"
          :class="{ rotated: pip.rotated }"
          :style="{ left: `${pip.x}%`, top: `${pip.y}%` }"
        >
          {{ suitSymbol }}
        </span>
      </div>

      <div v-else-if="isFaceCard" class="face-card" aria-hidden="true">
        <span class="face-side-symbol">{{ suitSymbol }}</span>
        <span class="face-letter">{{ rankLabel }}</span>
        <span class="face-side-symbol">{{ suitSymbol }}</span>
      </div>

      <span class="corner bottom" aria-hidden="true">{{ rankLabel }}{{ suitSymbol }}</span>
    </template>
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

.pip-grid {
  position: relative;
  flex: 1;
}

.pip {
  position: absolute;
  transform: translate(-50%, -50%);
  font-size: 0.9rem;
  line-height: 1;
}

.pip.rotated {
  transform: translate(-50%, -50%) rotate(180deg);
}

.face-card {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
}

.face-letter {
  font-size: 2rem;
  font-weight: bold;
}

.face-side-symbol {
  font-size: 1.1rem;
}
</style>
