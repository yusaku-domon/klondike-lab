<script setup lang="ts">
import type { Card } from '../domain/cards'
import PlayingCard from './PlayingCard.vue'

const props = defineProps<{
  column: Card[]
  columnIndex: number
  selectedFromIndex: number | null
}>()

const emit = defineEmits<{ select: [cardIndex: number | null] }>()

function isSelected(index: number): boolean {
  return props.selectedFromIndex !== null && index >= props.selectedFromIndex
}
</script>

<template>
  <div class="tableau-column" role="group" :aria-label="`場札${columnIndex + 1}列目`">
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
      :style="{ top: `${index * 1.6}rem` }"
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
  width: 4.5rem;
  min-height: 6.5rem;
}

.empty-column {
  width: 4.5rem;
  height: 6.5rem;
  border-radius: 0.4rem;
  border: 2px dashed #7fbf9e;
  background: transparent;
  padding: 0;
}

.card-slot {
  position: absolute;
  left: 0;
}
</style>
