export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades'

export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13

export type CardColor = 'red' | 'black'

export interface Card {
  id: string
  suit: Suit
  rank: Rank
  faceUp: boolean
}

export const SUITS: readonly Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

export function getCardColor(suit: Suit): CardColor {
  return suit === 'diamonds' || suit === 'hearts' ? 'red' : 'black'
}

export function createCardId(suit: Suit, rank: Rank): string {
  return `${suit}-${rank}`
}

export function createCard(suit: Suit, rank: Rank, faceUp = false): Card {
  return {
    id: createCardId(suit, rank),
    suit,
    rank,
    faceUp,
  }
}
