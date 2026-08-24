import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loadSettings, saveSettings } from '../persistence/settingsStorage'

export const useSettingsStore = defineStore('settings', () => {
  const moveNavigationEnabled = ref(loadSettings().moveNavigationEnabled)

  function setMoveNavigationEnabled(value: boolean) {
    moveNavigationEnabled.value = value
    saveSettings({ moveNavigationEnabled: value })
  }

  return { moveNavigationEnabled, setMoveNavigationEnabled }
})
