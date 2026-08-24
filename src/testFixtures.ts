import type { GameState } from './domain/deal'

/** A blank, valid GameState for tests to build specific fixtures on top of
 * via `overrides` — shared so every test file constructs the same baseline
 * shape instead of each redefining it independently. */
export function emptyState(overrides: Partial<GameState> = {}): GameState {
  return {
    schemaVersion: 1,
    rulesVersion: 1,
    shuffleVersion: 1,
    scoringVersion: 1,
    seed: 0,
    stock: [],
    waste: [],
    tableau: [[], [], [], [], [], [], []],
    foundations: { clubs: [], diamonds: [], hearts: [], spades: [] },
    score: 0,
    elapsedSeconds: 0,
    status: 'playing',
    moveCount: 0,
    ...overrides,
  }
}
