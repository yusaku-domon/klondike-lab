// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialGameState } from '../domain/deal'
import { clearGame, loadGame, saveGame, STORAGE_KEY } from './gameStorage'

beforeEach(() => {
  localStorage.clear()
})

describe('saveGame / loadGame round trip', () => {
  it('restores an identical GameState after saving', () => {
    const state = createInitialGameState(42)

    expect(saveGame(state)).toBe(true)
    expect(loadGame()).toEqual(state)
  })

  it('stores the state alongside a savedAt timestamp', () => {
    const state = createInitialGameState(1)
    saveGame(state)

    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(raw.state).toEqual(state)
    expect(typeof raw.savedAt).toBe('number')
  })
})

describe('loadGame', () => {
  it('returns null when nothing has been saved', () => {
    expect(loadGame()).toBeNull()
  })

  it('returns null for corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')
    expect(loadGame()).toBeNull()
  })

  it('returns null for an unknown schemaVersion', () => {
    const state = createInitialGameState(1)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { ...state, schemaVersion: 999 }, savedAt: 0 }),
    )
    expect(loadGame()).toBeNull()
  })

  it('returns null when a card is missing (broken 52-card invariant)', () => {
    const state = createInitialGameState(1)
    const broken = { ...state, stock: state.stock.slice(1) }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: broken, savedAt: 0 }))
    expect(loadGame()).toBeNull()
  })

  it('returns null when a required field has the wrong type', () => {
    const state = createInitialGameState(1)
    const broken = { ...state, status: 'not-a-status' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: broken, savedAt: 0 }))
    expect(loadGame()).toBeNull()
  })

  it('returns null when the tableau does not have exactly 7 columns', () => {
    const state = createInitialGameState(1)
    const broken = { ...state, tableau: state.tableau.slice(0, 6) }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: broken, savedAt: 0 }))
    expect(loadGame()).toBeNull()
  })
})

describe('saveGame', () => {
  it('returns false without throwing when localStorage.setItem fails', () => {
    const state = createInitialGameState(1)
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(() => saveGame(state)).not.toThrow()
    expect(saveGame(state)).toBe(false)

    setItemSpy.mockRestore()
  })
})

describe('clearGame', () => {
  it('removes the saved game', () => {
    saveGame(createInitialGameState(1))
    expect(loadGame()).not.toBeNull()

    clearGame()

    expect(loadGame()).toBeNull()
  })
})
