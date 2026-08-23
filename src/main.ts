import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'

createApp(App).use(createPinia()).mount('#app')

// registerType: 'prompt' — never swap in a new service worker while the
// user might be mid-game; only do it once they explicitly confirm.
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('新しいバージョンが利用可能です。今すぐ更新しますか？')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.info('Klondike Lab is ready to play offline.')
  },
})
