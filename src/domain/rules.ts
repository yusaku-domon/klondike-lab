import { getCardColor, type Card } from './cards'

export function isValidTableauRun(cards: readonly Card[]): boolean {
  if (cards.length === 0) return false
  if (!cards.every((card) => card.faceUp)) return false

  for (let i = 0; i < cards.length - 1; i++) {
    const current = cards[i]!
    const next = cards[i + 1]!
    if (next.rank !== current.rank - 1) return false
    if (getCardColor(next.suit) === getCardColor(current.suit)) return false
  }

  return true
}

export function canPlaceOnTableau(
  destinationColumn: readonly Card[],
  movingCards: readonly Card[],
): boolean {
  if (!isValidTableauRun(movingCards)) return false

  const bottomOfMovingGroup = movingCards[0]!

  if (destinationColumn.length === 0) {
    return bottomOfMovingGroup.rank === 13
  }

  const destinationTop = destinationColumn[destinationColumn.length - 1]!
  return (
    bottomOfMovingGroup.rank === destinationTop.rank - 1 &&
    getCardColor(bottomOfMovingGroup.suit) !== getCardColor(destinationTop.suit)
  )
}

export function canPlaceOnFoundation(foundationPile: readonly Card[], card: Card): boolean {
  if (!card.faceUp) return false
  if (foundationPile.length === 0) return card.rank === 1

  const top = foundationPile[foundationPile.length - 1]!
  return card.suit === top.suit && card.rank === top.rank + 1
}
