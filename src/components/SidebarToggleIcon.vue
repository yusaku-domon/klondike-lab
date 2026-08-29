<script setup lang="ts">
// Shared by GameToolbar.vue's header "open" button and Sidebar.vue's
// in-panel "close" button, so the chevron/lines artwork only exists once —
// each caller just says which state it represents.
defineProps<{ open: boolean }>()
</script>

<template>
  <span class="toggle-icon" :class="{ 'toggle-icon--open': open }">
    <svg class="toggle-icon__chevron" viewBox="0 0 6 10" aria-hidden="true" focusable="false">
      <path
        d="M1.2 1 L4.8 5 L1.2 9"
        fill="none"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <svg class="toggle-icon__lines" viewBox="0 0 14 10" aria-hidden="true" focusable="false">
      <line x1="0" y1="1" x2="14" y2="1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      <line x1="0" y1="5" x2="14" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      <line x1="0" y1="9" x2="14" y2="9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </svg>
  </span>
</template>

<style scoped>
/* Chevron and lines are laid out with flex `order`, not separate v-if
   branches — both SVGs stay mounted the whole time and just swap
   position/direction, so there's never a moment with both variants (or
   neither) in the DOM. */
.toggle-icon {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.toggle-icon__chevron {
  order: 0;
  width: 0.4rem;
  height: 0.65rem;
}

.toggle-icon__lines {
  order: 1;
  width: 0.9rem;
  height: 0.65rem;
}

.toggle-icon--open .toggle-icon__chevron {
  order: 1;
  /* Mirrors the same right-pointing path into a left-pointing one instead
     of swapping in a second path — one <path> to keep in sync, not two. */
  transform: scaleX(-1);
}

.toggle-icon--open .toggle-icon__lines {
  order: 0;
}
</style>
