<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '../domain/cards'
import PlayingCard from './PlayingCard.vue'

const props = defineProps<{ waste: Card[]; selected: boolean }>()
defineEmits<{ click: [] }>()

const topCard = computed<Card | null>(() => props.waste[props.waste.length - 1] ?? null)
</script>

<template>
  <PlayingCard v-if="topCard" :card="topCard" :selected="selected" interactive @select="$emit('click')" />
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
  width: 4.5rem;
  height: 6.5rem;
  border-radius: 0.4rem;
  border: 2px dashed #7fbf9e;
  background: transparent;
  padding: 0;
}
</style>
