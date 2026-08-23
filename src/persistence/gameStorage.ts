import { SUITS, type Card, type Rank, type Suit } from '../domain/cards'
import type { GameState, GameStatus } from '../domain/deal'
import { isCompleteUniqueDeck } from '../domain/invariants'
import { migrateToCurrentSchema } from './migrations'

export const STORAGE_KEY = 'klondike-lab.game'

export interface PersistedGame {
  state: GameState
  savedAt: number
}

function isRank(value: unknown): value is Rank {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 13
}

function isSuit(value: unknown): value is Suit {
  return typeof value === 'string' && (SUITS as readonly string[]).includes(value)
}

function isCard(value: unknown): value is Card {
  if (typeof value !== 'object' || value === null) return false
  const card = value as Record<string, unknown>
  return (
    typeof card.id === 'string' &&
    isSuit(card.suit) &&
    isRank(card.rank) &&
    typeof card.faceUp === 'boolean' &&
    card.id === `${card.suit}-${card.rank}`
  )
}

function isCardArray(value: unknown): value is Card[] {
  return Array.isArray(value) && value.every(isCard)
}

function isGameStatus(value: unknown): value is GameStatus {
  return value === 'playing' || value === 'paused' || value === 'won'
}

export function isValidGameState(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false
  const state = value as Record<string, unknown>

  if (state.schemaVersion !== 1) return false
  if (state.rulesVersion !== 1) return false
  if (state.shuffleVersion !== 1) return false
  if (state.scoringVersion !== 1) return false
  if (typeof state.seed !== 'number') return false
  if (!isCardArray(state.stock)) return false
  if (!isCardArray(state.waste)) return false
  if (!Array.isArray(state.tableau) || state.tableau.length !== 7 || !state.tableau.every(isCardArray)) {
    return false
  }
  if (typeof state.foundations !== 'object' || state.foundations === null) return false
  const foundations = state.foundations as Record<string, unknown>
  if (!SUITS.every((suit) => isCardArray(foundations[suit]))) return false
  if (typeof state.score !== 'number' || state.score < 0) return false
  if (typeof state.elapsedSeconds !== 'number' || state.elapsedSeconds < 0) return false
  if (!isGameStatus(state.status)) return false
  if (typeof state.moveCount !== 'number' || state.moveCount < 0) return false

  const allCards: Card[] = [
    ...(state.stock as Card[]),
    ...(state.waste as Card[]),
    ...(state.tableau as Card[][]).flat(),
    ...SUITS.flatMap((suit) => foundations[suit] as Card[]),
  ]

  return isCompleteUniqueDeck(allCards)
}

export function saveGame(state: GameState): boolean {
  try {
    const payload: PersistedGame = { state, savedAt: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null

    const rawState = (parsed as Record<string, unknown>).state
    const migrated = migrateToCurrentSchema(rawState)
    if (migrated === null || !isValidGameState(migrated)) return null

    return migrated
  } catch {
    return null
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Non-fatal: nothing to clean up if storage is unavailable.
  }
}
