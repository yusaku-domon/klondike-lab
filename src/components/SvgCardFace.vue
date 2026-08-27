<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '../domain/cards'
import type { CardDesign } from '../persistence/settingsStorage'

const props = defineProps<{
  /** Which vendored SVG deck to render from — 'classic' never reaches this
   * component (PlayingCard.vue renders its own text-based face for that). */
  deck: Exclude<CardDesign, 'classic'>
  card: Card
}>()

// Each deck ships one file per face plus a single shared back design, all
// under public/cards/<deck>/ so Vite copies them verbatim into the build
// output and the PWA's existing svg precache glob picks them up for free.
const src = computed(() =>
  props.card.faceUp
    ? `/cards/${props.deck}/${props.card.suit}-${props.card.rank}.svg`
    : `/cards/${props.deck}/back.svg`,
)
</script>

<template>
  <img :src="src" alt="" class="card-face-image" />
</template>

<style scoped>
.card-face-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: inherit;
}
</style>
