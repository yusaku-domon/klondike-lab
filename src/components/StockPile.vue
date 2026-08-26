<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ stockCount: number; wasteCount: number }>()
defineEmits<{ click: [] }>()

const ariaLabel = computed(() => {
  if (props.stockCount > 0) return `山札(残り${props.stockCount}枚)`
  if (props.wasteCount > 0) return '山札は空です。クリックすると捨て札を山札に戻します'
  return '山札は空です'
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
    <span v-if="stockCount > 0" class="card-back" aria-hidden="true" />
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

.recycle-icon {
  color: var(--color-text-on-dark);
  font-size: 1.8rem;
}
</style>
