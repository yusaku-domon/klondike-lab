import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loadSettings, saveSettings, type CardDesign } from '../persistence/settingsStorage'

export const useSettingsStore = defineStore('settings', () => {
  const initial = loadSettings()
  const moveNavigationEnabled = ref(initial.moveNavigationEnabled)
  const cardDesign = ref<CardDesign>(initial.cardDesign)

  function setMoveNavigationEnabled(value: boolean) {
    moveNavigationEnabled.value = value
    saveSettings({ moveNavigationEnabled: value, cardDesign: cardDesign.value })
  }

  function setCardDesign(value: CardDesign) {
    cardDesign.value = value
    saveSettings({ moveNavigationEnabled: moveNavigationEnabled.value, cardDesign: value })
  }

  return { moveNavigationEnabled, setMoveNavigationEnabled, cardDesign, setCardDesign }
})
