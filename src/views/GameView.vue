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
}
</style>
