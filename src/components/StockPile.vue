<script setup lang="ts">
import { computed } from 'vue'
import type { CardDesign } from '../persistence/settingsStorage'

const props = withDefaults(
  defineProps<{ stockCount: number; wasteCount: number; cardDesign?: CardDesign }>(),
  { cardDesign: 'classic' },
)
defineEmits<{ click: [] }>()

const ariaLabel = computed(() => {
  if (props.stockCount > 0) return `Stock (${props.stockCount} cards left)`
  if (props.wasteCount > 0) return 'Stock is empty. Click to move the waste pile back to the stock.'
  return 'Stock is empty'
})
</script>

<template>
  <button
    type="button"
    class="stock-pile"
    data-testid="stock-pile"
    :aria-label="ariaLabel"
    @click="$emit('click')"
  >
    <span v-if="stockCount > 0 && cardDesign === 'classic'" class="card-back" aria-hidden="true" />
    <img
      v-else-if="stockCount > 0"
      :src="`/cards/${cardDesign}/back.svg`"
      alt=""
      class="card-back-image"
    />
    <span v-else-if="wasteCount > 0" class="recycle-icon" aria-hidden="true">&#8635;</span>
  </button>
</template>

<style scoped>
.stock-pile {
  width: var(--card-width);
  height: var(--card-height);
  border-radius: 0.4rem;
  border: 2px dashed var(--color-outline);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

.card-back {
  width: 100%;
  height: 100%;
  border-radius: 0.3rem;
  background: var(--card-back-pattern);
  display: block;
}

.card-back-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.recycle-icon {
  color: var(--color-text-on-dark);
  font-size: 1.8rem;
}
</style>
