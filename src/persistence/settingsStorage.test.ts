// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, STORAGE_KEY } from './settingsStorage'

beforeEach(() => {
  localStorage.clear()
})

describe('saveSettings / loadSettings round trip', () => {
  it('restores identical settings after saving', () => {
    expect(saveSettings({ moveNavigationEnabled: false, cardDesign: 'classic' })).toBe(true)
    expect(loadSettings()).toEqual({ moveNavigationEnabled: false, cardDesign: 'classic' })
  })

  it('restores true just as reliably as false', () => {
    saveSettings({ moveNavigationEnabled: true, cardDesign: 'classic' })
    expect(loadSettings()).toEqual({ moveNavigationEnabled: true, cardDesign: 'classic' })
  })

  it('round-trips each card design', () => {
    for (const cardDesign of ['classic', 'saulspatz'] as const) {
      saveSettings({ moveNavigationEnabled: true, cardDesign })
      expect(loadSettings().cardDesign).toBe(cardDesign)
    }
  })
})

describe('loadSettings', () => {
  it('returns the default (moveNavigationEnabled: true, cardDesign: classic) when nothing has been saved', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings().moveNavigationEnabled).toBe(true)
    expect(loadSettings().cardDesign).toBe('classic')
  })

  it('falls back to the default for corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to the default when moveNavigationEnabled has the wrong type', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ moveNavigationEnabled: 'yes', cardDesign: 'classic' }),
    )
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to the default when cardDesign is not one of the known designs', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ moveNavigationEnabled: true, cardDesign: 'not-a-real-deck' }),
    )
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

    expect(() =>
      saveSettings({ moveNavigationEnabled: true, cardDesign: 'classic' }),
    ).not.toThrow()
    expect(saveSettings({ moveNavigationEnabled: true, cardDesign: 'classic' })).toBe(false)

    setItemSpy.mockRestore()
  })
})
