<script setup lang="ts">
import { ref } from 'vue'
import GameBoard from '../components/GameBoard.vue'
import GameToolbar from '../components/GameToolbar.vue'
import Sidebar from '../components/Sidebar.vue'

const sidebarOpen = ref(false)
// Hidden the instant the sidebar starts opening (not waiting for its slide
// to finish), and shown again only once Sidebar.vue reports its own close
// animation has actually finished — so the header's open button and the
// sidebar's own close button are never both on screen at once, and there's
// never a gap where the sidebar is fully closed but the header button
// hasn't reappeared yet, or a moment where both linger during the slide.
const showSidebarToggle = ref(true)

function openSidebar() {
  sidebarOpen.value = true
  showSidebarToggle.value = false
}

function closeSidebar() {
  sidebarOpen.value = false
}

function handleSidebarFullyClosed() {
  showSidebarToggle.value = true
}
</script>

<template>
  <div class="game-view">
    <Sidebar :open="sidebarOpen" @close="closeSidebar" @fully-closed="handleSidebarFullyClosed" />
    <GameToolbar :show-sidebar-toggle="showSidebarToggle" @open-sidebar="openSidebar" />
    <GameBoard />
  </div>
</template>

<style scoped>
.game-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  /* "Felt Backgrounds" (jbp4444, OpenGameArt, CC0 1.0) recolored to this
     felt green — see THIRD_PARTY_NOTICES.md. Shown with cover/no-repeat
     rather than tiled: this source image visibly seams when repeated (a
     problem reported in the asset's own OpenGameArt comments), so a
     single non-repeating image sized to always fully cover the whole
     view avoids the seam entirely, at the cost of not being a true tile.
     #0e7a44 is both the image's own base tone and the fallback color if
     the image fails to load (e.g. mid-fetch on a flaky connection); it's
     deliberately not var(--color-felt) (#0f7a44, a 1-unit-different but
     otherwise unrelated token also used by the Settings/Seed modals,
     which this background must not affect).

     Deliberately the RAW image only, with no dimming overlay baked in
     here — that lives separately on GameBoard.vue's own .game-board (its
     own translucent rgba(14,122,68,0.8) layer) and GameToolbar.vue's
     .toolbar (its own translucent rgba(11,61,36) header color), each
     compositing independently against this same shared texture. Layering
     both dimming steps on top of each other in one place here (image +
     board tint) would have left the header — sitting on top of an
     *already* 80%-flattened result — showing essentially no felt at all
     regardless of its own opacity, which measurably fails "faintly
     visible on a close look" for the header specifically. */
  background-color: #0e7a44;
  background-image: url('../assets/textures/board-felt.webp');
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
}
</style>
