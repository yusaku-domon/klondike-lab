<script setup lang="ts">
import type { Card } from '../domain/cards'
import { TABLEAU_STACK_OFFSET_REM, type HighlightLevel } from './boardLayout'
import PlayingCard from './PlayingCard.vue'

const props = withDefaults(
  defineProps<{
    column: Card[]
    columnIndex: number
    selectedFromIndex: number | null
    /** Move-navigation hint level for this column's empty-slot frame — the
     * caller only ever passes non-'none' here while the column is empty;
     * once it holds cards, the receiving (top) card is highlighted
     * directly on CardAnimationLayer instead, so the whole column no
     * longer lights up as a destination. */
    highlight?: HighlightLevel
  }>(),
  { highlight: 'none' },
)

const emit = defineEmits<{ select: [cardIndex: number | null] }>()

function isSelected(index: number): boolean {
  return props.selectedFromIndex !== null && index >= props.selectedFromIndex
}
</script>

<template>
  <div
    class="tableau-column"
    :class="highlight !== 'none' ? `nav-${highlight}` : undefined"
    role="group"
    :aria-label="`場札${columnIndex + 1}列目`"
  >
    <button
      v-if="column.length === 0"
      type="button"
      class="empty-column"
      :data-testid="`tableau-empty-${columnIndex}`"
      :aria-label="`空の場札列(${columnIndex + 1}列目)`"
      @click="emit('select', null)"
    />
    <div
      v-for="(card, index) in column"
      :key="card.id"
      class="card-slot"
      :style="{ top: `${index * TABLEAU_STACK_OFFSET_REM}rem` }"
    >
      <PlayingCard
        :card="card"
        :selected="isSelected(index)"
        :interactive="card.faceUp"
        ghost
        @select="emit('select', index)"
      />
    </div>
  </div>
</template>

<style scoped>
.tableau-column {
  position: relative;
  width: var(--card-width);
  min-height: var(--card-height);
}

/* Move-navigation hint for an empty column's own frame (see the highlight
   prop doc above — this only ever fires while the column is empty). The
   .nav-weak/.nav-strong box-shadow itself is defined globally in
   style.css; unlike .empty-pile/.playing-card, .tableau-column has no
   border-radius of its own, so it needs one only while highlighted. */
.tableau-column.nav-weak,
.tableau-column.nav-strong {
  border-radius: 0.4rem;
}

.empty-column {
  width: var(--card-width);
  height: var(--card-height);
  border-radius: 0.4rem;
  border: 2px dashed var(--color-outline);
  background: transparent;
  padding: 0;
}

.card-slot {
  position: absolute;
  left: 0;
}
</style>
