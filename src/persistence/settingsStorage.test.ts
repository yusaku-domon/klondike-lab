// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, STORAGE_KEY } from './settingsStorage'

beforeEach(() => {
  localStorage.clear()
})

describe('saveSettings / loadSettings round trip', () => {
  it('restores identical settings after saving', () => {
    expect(saveSettings({ moveNavigationEnabled: false })).toBe(true)
    expect(loadSettings()).toEqual({ moveNavigationEnabled: false })
  })

  it('restores true just as reliably as false', () => {
    saveSettings({ moveNavigationEnabled: true })
    expect(loadSettings()).toEqual({ moveNavigationEnabled: true })
  })
})

describe('loadSettings', () => {
  it('returns the default (moveNavigationEnabled: true) when nothing has been saved', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings().moveNavigationEnabled).toBe(true)
  })

  it('falls back to the default for corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to the default when the field has the wrong type', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ moveNavigationEnabled: 'yes' }))
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to the default when the payload is not an object', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(null))
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})

describe('saveSettings', () => {
  it('returns false without throwing when localStorage.setItem fails', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(() => saveSettings({ moveNavigationEnabled: true })).not.toThrow()
    expect(saveSettings({ moveNavigationEnabled: true })).toBe(false)

    setItemSpy.mockRestore()
  })
})
