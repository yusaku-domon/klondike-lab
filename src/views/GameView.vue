<script setup lang="ts">
import GameBoard from '../components/GameBoard.vue'
import GameToolbar from '../components/GameToolbar.vue'
</script>

<template>
  <div class="game-view">
    <GameToolbar />
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
