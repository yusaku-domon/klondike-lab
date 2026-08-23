import { RANKS, SUITS, createCardId, type Card } from './cards'

const FULL_DECK_ID_SET: ReadonlySet<string> = new Set(
  SUITS.flatMap((suit) => RANKS.map((rank) => createCardId(suit, rank))),
)

export function isCompleteUniqueDeck(cards: readonly Card[]): boolean {
  if (cards.length !== FULL_DECK_ID_SET.size) {
    return false
  }

  const seenIds = new Set<string>()
  for (const card of cards) {
    if (!FULL_DECK_ID_SET.has(card.id) || seenIds.has(card.id)) {
      return false
    }
    seenIds.add(card.id)
  }

  return true
}
