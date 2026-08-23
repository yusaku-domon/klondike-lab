import type { Card, Suit } from './cards'
import { createStandardDeck } from './deck'
import { SHUFFLE_VERSION, shuffleDeck, type ShuffleSeed } from './shuffle'

export type GameStatus = 'playing' | 'paused' | 'won'

export interface GameState {
  schemaVersion: 1
  rulesVersion: 1
  shuffleVersion: 1
  scoringVersion: 1
  seed: number
  stock: Card[]
  waste: Card[]
  tableau: [Card[], Card[], Card[], Card[], Card[], Card[], Card[]]
  foundations: Record<Suit, Card[]>
  score: number
  elapsedSeconds: number
  status: GameStatus
  moveCount: number
}

const TABLEAU_COLUMN_COUNT = 7

export function createInitialGameState(seed: ShuffleSeed): GameState {
  const shuffled = shuffleDeck(createStandardDeck(), seed)
  let cursor = 0

  const tableau = Array.from({ length: TABLEAU_COLUMN_COUNT }, (_, columnIndex) => {
    const columnSize = columnIndex + 1
    const column = shuffled.slice(cursor, cursor + columnSize).map((card, cardIndex) => ({
      ...card,
      faceUp: cardIndex === columnSize - 1,
    }))
    cursor += columnSize
    return column
  }) as GameState['tableau']

  const stock = shuffled.slice(cursor).map((card) => ({ ...card, faceUp: false }))

  return {
    schemaVersion: 1,
    rulesVersion: 1,
    shuffleVersion: SHUFFLE_VERSION,
    scoringVersion: 1,
    seed,
    stock,
    waste: [],
    tableau,
    foundations: {
      clubs: [],
      diamonds: [],
      hearts: [],
      spades: [],
    },
    score: 0,
    elapsedSeconds: 0,
    status: 'playing',
    moveCount: 0,
  }
}
