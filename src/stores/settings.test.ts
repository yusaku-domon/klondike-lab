// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadSettings, STORAGE_KEY } from '../persistence/settingsStorage'
import { useSettingsStore } from './settings'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('useSettingsStore', () => {
  it('defaults moveNavigationEnabled to true when nothing was saved', () => {
    const store = useSettingsStore()
    expect(store.moveNavigationEnabled).toBe(true)
  })

  it('restores a previously saved false value on init', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ moveNavigationEnabled: false }))
    const store = useSettingsStore()
    expect(store.moveNavigationEnabled).toBe(false)
  })

  it('setMoveNavigationEnabled updates state and persists immediately', () => {
    const store = useSettingsStore()

    store.setMoveNavigationEnabled(false)
    expect(store.moveNavigationEnabled).toBe(false)
    expect(loadSettings().moveNavigationEnabled).toBe(false)

    store.setMoveNavigationEnabled(true)
    expect(store.moveNavigationEnabled).toBe(true)
    expect(loadSettings().moveNavigationEnabled).toBe(true)
  })
})
