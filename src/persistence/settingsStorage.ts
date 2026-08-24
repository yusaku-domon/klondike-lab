export const STORAGE_KEY = 'klondike-lab.settings'

export interface Settings {
  /** Highlights the current selection's legal destinations on the board. */
  moveNavigationEnabled: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  moveNavigationEnabled: true,
}

function isValidSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) return false
  const settings = value as Record<string, unknown>
  return typeof settings.moveNavigationEnabled === 'boolean'
}

export function saveSettings(settings: Settings): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS

    const parsed: unknown = JSON.parse(raw)
    return isValidSettings(parsed) ? parsed : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}
