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

// Display strings shared by every component that renders a suit (PlayingCard,
// FoundationPile), so the symbol/label for a given suit can't drift between
// them.
export const SUIT_SYMBOLS: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
}

export const SUIT_NAMES: Record<Suit, string> = {
  clubs: 'Clubs',
  diamonds: 'Diamonds',
  hearts: 'Hearts',
  spades: 'Spades',
}

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
