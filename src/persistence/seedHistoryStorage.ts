export const SEED_HISTORY_STORAGE_KEY = 'klondike-lab.seedHistory'

/** Newest-first; older entries beyond this are dropped on write. */
export const SEED_HISTORY_MAX_ENTRIES = 5

export type SeedResult = 'win' | 'lose'

export interface SeedHistoryEntry {
  seed: number
  result: SeedResult
}

function isSeedResult(value: unknown): value is SeedResult {
  return value === 'win' || value === 'lose'
}

function isSeedHistoryEntry(value: unknown): value is SeedHistoryEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return typeof entry.seed === 'number' && isSeedResult(entry.result)
}

function isSeedHistory(value: unknown): value is SeedHistoryEntry[] {
  return Array.isArray(value) && value.every(isSeedHistoryEntry)
}

export function saveSeedHistory(entries: SeedHistoryEntry[]): boolean {
  try {
    localStorage.setItem(SEED_HISTORY_STORAGE_KEY, JSON.stringify(entries))
    return true
  } catch {
    return false
  }
}

export function loadSeedHistory(): SeedHistoryEntry[] {
  try {
    const raw = localStorage.getItem(SEED_HISTORY_STORAGE_KEY)
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    return isSeedHistory(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Prepends the new result, trims to SEED_HISTORY_MAX_ENTRIES, persists, and
 * returns the updated list — the caller (the game store) uses the return
 * value directly rather than re-reading storage. */
export function recordSeedResult(seed: number, result: SeedResult): SeedHistoryEntry[] {
  const updated = [{ seed, result }, ...loadSeedHistory()].slice(0, SEED_HISTORY_MAX_ENTRIES)
  saveSeedHistory(updated)
  return updated
}
