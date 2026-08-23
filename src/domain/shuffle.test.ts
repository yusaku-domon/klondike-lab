import { describe, expect, it } from 'vitest'
import { createStandardDeck } from './deck'
import { isCompleteUniqueDeck } from './invariants'
import { shuffleDeck } from './shuffle'

describe('shuffleDeck', () => {
  it('produces the same order for the same seed', () => {
    const deck = createStandardDeck()
    const first = shuffleDeck(deck, 42)
    const second = shuffleDeck(deck, 42)
    expect(first.map((card) => card.id)).toEqual(second.map((card) => card.id))
  })

  it('produces a different order for a different seed', () => {
    const deck = createStandardDeck()
    const a = shuffleDeck(deck, 1)
    const b = shuffleDeck(deck, 2)
    expect(a.map((card) => card.id)).not.toEqual(b.map((card) => card.id))
  })

  it('does not mutate the input array or its cards', () => {
    const deck = createStandardDeck()
    const originalIds = deck.map((card) => card.id)
    const originalFaceUp = deck.map((card) => card.faceUp)

    shuffleDeck(deck, 12345)

    expect(deck.map((card) => card.id)).toEqual(originalIds)
    expect(deck.map((card) => card.faceUp)).toEqual(originalFaceUp)
  })

  it('keeps all 52 cards unique after shuffling', () => {
    const deck = createStandardDeck()
    expect(isCompleteUniqueDeck(shuffleDeck(deck, 999))).toBe(true)
  })

  it('handles an empty deck', () => {
    expect(shuffleDeck([], 42)).toEqual([])
  })

  it('handles a single-card deck', () => {
    const deck = createStandardDeck().slice(0, 1)
    expect(shuffleDeck(deck, 42)).toEqual(deck)
  })

  it('supports the minimum seed boundary (0)', () => {
    expect(isCompleteUniqueDeck(shuffleDeck(createStandardDeck(), 0))).toBe(true)
  })

  it('supports the maximum seed boundary (0xffffffff)', () => {
    expect(isCompleteUniqueDeck(shuffleDeck(createStandardDeck(), 0xffffffff))).toBe(true)
  })

  it('matches the recorded expected order for a fixed seed (regression guard)', () => {
    const order = shuffleDeck(createStandardDeck(), 123456789).map((card) => card.id)

    expect(order).toEqual([
      'diamonds-13', 'clubs-9', 'hearts-13', 'hearts-3', 'diamonds-4', 'spades-3',
      'diamonds-11', 'hearts-7', 'hearts-6', 'diamonds-12', 'hearts-12', 'hearts-4',
      'clubs-12', 'spades-10', 'spades-2', 'spades-5', 'clubs-4', 'clubs-3',
      'spades-7', 'clubs-6', 'clubs-10', 'diamonds-7', 'clubs-5', 'hearts-8',
      'hearts-9', 'clubs-8', 'diamonds-8', 'spades-13', 'hearts-11', 'spades-12',
      'spades-6', 'clubs-2', 'hearts-2', 'hearts-1', 'spades-9', 'diamonds-9',
      'hearts-5', 'diamonds-6', 'spades-4', 'diamonds-10', 'diamonds-5', 'diamonds-3',
      'clubs-7', 'clubs-1', 'clubs-13', 'spades-8', 'hearts-10', 'diamonds-2',
      'clubs-11', 'spades-1', 'spades-11', 'diamonds-1',
    ])
  })
})
