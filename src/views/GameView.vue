<script setup lang="ts">
import { ref } from 'vue'
import GameBoard from '../components/GameBoard.vue'
import GameToolbar from '../components/GameToolbar.vue'
import Sidebar from '../components/Sidebar.vue'

const sidebarOpen = ref(false)

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function closeSidebar() {
  sidebarOpen.value = false
}
</script>

<template>
  <div class="game-view">
    <Sidebar :open="sidebarOpen" @close="closeSidebar" />
    <GameToolbar :sidebar-open="sidebarOpen" @toggle-sidebar="toggleSidebar" />
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
