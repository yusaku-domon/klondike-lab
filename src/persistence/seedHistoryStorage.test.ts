// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadSeedHistory,
  recordSeedResult,
  saveSeedHistory,
  SEED_HISTORY_MAX_ENTRIES,
  SEED_HISTORY_STORAGE_KEY,
} from './seedHistoryStorage'

beforeEach(() => {
  localStorage.clear()
})

describe('saveSeedHistory / loadSeedHistory round trip', () => {
  it('restores identical entries after saving', () => {
    const entries = [
      { seed: 42, result: 'win' as const },
      { seed: 7, result: 'lose' as const },
    ]
    expect(saveSeedHistory(entries)).toBe(true)
    expect(loadSeedHistory()).toEqual(entries)
  })
})

describe('loadSeedHistory', () => {
  it('returns an empty array when nothing has been saved', () => {
    expect(loadSeedHistory()).toEqual([])
  })

  it('falls back to an empty array for corrupted JSON', () => {
    localStorage.setItem(SEED_HISTORY_STORAGE_KEY, '{not valid json')
    expect(loadSeedHistory()).toEqual([])
  })

  it('falls back to an empty array when an entry has the wrong shape', () => {
    localStorage.setItem(
      SEED_HISTORY_STORAGE_KEY,
      JSON.stringify([{ seed: 'not-a-number', result: 'win' }]),
    )
    expect(loadSeedHistory()).toEqual([])
  })

  it('falls back to an empty array when result is not win/lose', () => {
    localStorage.setItem(SEED_HISTORY_STORAGE_KEY, JSON.stringify([{ seed: 1, result: 'draw' }]))
    expect(loadSeedHistory()).toEqual([])
  })

  it('falls back to an empty array when the payload is not an array', () => {
    localStorage.setItem(SEED_HISTORY_STORAGE_KEY, JSON.stringify({ seed: 1, result: 'win' }))
    expect(loadSeedHistory()).toEqual([])
  })
})

describe('saveSeedHistory', () => {
  it('returns false without throwing when localStorage.setItem fails', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(() => saveSeedHistory([{ seed: 1, result: 'win' }])).not.toThrow()
    expect(saveSeedHistory([{ seed: 1, result: 'win' }])).toBe(false)

    setItemSpy.mockRestore()
  })
})

describe('recordSeedResult', () => {
  it('prepends the new entry so it reads newest-first', () => {
    recordSeedResult(1, 'win')
    const updated = recordSeedResult(2, 'lose')

    expect(updated).toEqual([
      { seed: 2, result: 'lose' },
      { seed: 1, result: 'win' },
    ])
  })

  it('persists the updated list, not just returns it', () => {
    recordSeedResult(1, 'win')
    expect(loadSeedHistory()).toEqual([{ seed: 1, result: 'win' }])
  })

  it(`keeps only the newest ${SEED_HISTORY_MAX_ENTRIES} entries`, () => {
    let updated: ReturnType<typeof recordSeedResult> = []
    for (let seed = 1; seed <= SEED_HISTORY_MAX_ENTRIES + 2; seed++) {
      updated = recordSeedResult(seed, 'win')
    }

    expect(updated).toHaveLength(SEED_HISTORY_MAX_ENTRIES)
    // Newest-first: the most recently recorded seed is still first, and the
    // two oldest (seeds 1 and 2) were dropped.
    expect(updated[0]).toEqual({ seed: SEED_HISTORY_MAX_ENTRIES + 2, result: 'win' })
    expect(updated.some((entry) => entry.seed === 1)).toBe(false)
    expect(updated.some((entry) => entry.seed === 2)).toBe(false)
  })
})
