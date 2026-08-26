<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '../domain/cards'
import PlayingCard from './PlayingCard.vue'

const props = defineProps<{ waste: Card[]; selected: boolean }>()
defineEmits<{ click: [] }>()

const topCard = computed<Card | null>(() => props.waste[props.waste.length - 1] ?? null)
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
    data-testid="waste-empty"
    aria-label="捨て札は空です"
    @click="$emit('click')"
  />
</template>

<style scoped>
.empty-pile {
  width: var(--card-width);
  height: var(--card-height);
  border-radius: 0.4rem;
  border: 2px dashed var(--color-outline);
  background: transparent;
  padding: 0;
}
</style>
