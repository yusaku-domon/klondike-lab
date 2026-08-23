import { describe, expect, it } from 'vitest'
import { createCard } from './cards'
import { createStandardDeck } from './deck'
import { isCompleteUniqueDeck } from './invariants'

describe('isCompleteUniqueDeck', () => {
  it('accepts a full standard deck', () => {
    expect(isCompleteUniqueDeck(createStandardDeck())).toBe(true)
  })

  it('rejects a deck missing a card', () => {
    const deck = createStandardDeck().slice(1)
    expect(isCompleteUniqueDeck(deck)).toBe(false)
  })

  it('rejects a deck with a duplicated card', () => {
    const deck = createStandardDeck()
    deck[1] = createCard(deck[0]!.suit, deck[0]!.rank)
    expect(isCompleteUniqueDeck(deck)).toBe(false)
  })

  it('rejects a deck with an extra, unrelated card', () => {
    const deck = [...createStandardDeck(), createCard('hearts', 1)]
    expect(isCompleteUniqueDeck(deck)).toBe(false)
  })
})
