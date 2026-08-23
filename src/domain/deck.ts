import { RANKS, SUITS, createCard, type Card } from './cards'

export function createStandardDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(createCard(suit, rank, false))
    }
  }
  return deck
}
