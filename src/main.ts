import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import './style.css'

createApp(App).use(createPinia()).mount('#app')

// registerType: 'prompt' — never swap in a new service worker while the
// user might be mid-game; only do it once they explicitly confirm.
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('A new version is available. Update now?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.info('Klondike Lab is ready to play offline.')
  },
})
