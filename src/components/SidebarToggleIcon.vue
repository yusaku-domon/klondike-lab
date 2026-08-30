<script setup lang="ts">
// Shared by GameToolbar.vue's header "open" button and Sidebar.vue's
// in-panel "close" button, so the closed/"open" state (open=false) and the
// open/"close" state (open=true) each only exist once. The two states are
// fully independent branches below — closed shows the chevron, open shows a
// plain close (X) icon — so changing one can never affect the other.
defineProps<{ open: boolean }>()
</script>

<template>
  <span class="toggle-icon" :class="{ 'toggle-icon--open': open }">
    <svg v-if="!open" class="toggle-icon__chevron" viewBox="0 0 6 10" aria-hidden="true" focusable="false">
      <path
        d="M1.2 1 L4.8 5 L1.2 9"
        fill="none"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <svg v-else class="toggle-icon__close" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path
        d="M3 3 L11 11 M11 3 L3 11"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
      />
    </svg>
  </span>
</template>

<style scoped>
.toggle-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-icon__chevron {
  width: 0.4rem;
  height: 0.65rem;
}

.toggle-icon__close {
  width: 0.9rem;
  height: 0.9rem;
}
</style>
