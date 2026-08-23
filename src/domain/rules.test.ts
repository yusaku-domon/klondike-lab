import { describe, expect, it } from 'vitest'
import { createCard } from './cards'
import { canPlaceOnFoundation, canPlaceOnTableau, isValidTableauRun } from './rules'

describe('isValidTableauRun', () => {
  it('rejects an empty selection', () => {
    expect(isValidTableauRun([])).toBe(false)
  })

  it('accepts a single face-up card', () => {
    expect(isValidTableauRun([createCard('hearts', 5, true)])).toBe(true)
  })

  it('rejects a selection containing a face-down card', () => {
    expect(isValidTableauRun([createCard('hearts', 5, false)])).toBe(false)
  })

  it('accepts a descending, alternating-color run', () => {
    const run = [
      createCard('clubs', 8, true),
      createCard('hearts', 7, true),
      createCard('spades', 6, true),
    ]
    expect(isValidTableauRun(run)).toBe(true)
  })

  it('rejects a run with a rank gap', () => {
    const run = [createCard('clubs', 8, true), createCard('hearts', 6, true)]
    expect(isValidTableauRun(run)).toBe(false)
  })

  it('rejects a run with same-colored adjacent cards', () => {
    const run = [createCard('clubs', 8, true), createCard('spades', 7, true)]
    expect(isValidTableauRun(run)).toBe(false)
  })
})

describe('canPlaceOnTableau', () => {
  it('allows a King (or a King-led run) on an empty column', () => {
    expect(canPlaceOnTableau([], [createCard('spades', 13, true)])).toBe(true)
  })

  it('rejects a non-King on an empty column', () => {
    expect(canPlaceOnTableau([], [createCard('spades', 12, true)])).toBe(false)
  })

  it('allows placing on a card one rank higher with the opposite color', () => {
    const destination = [createCard('hearts', 9, true)]
    expect(canPlaceOnTableau(destination, [createCard('clubs', 8, true)])).toBe(true)
  })

  it('rejects placing on a card of the wrong rank', () => {
    const destination = [createCard('hearts', 9, true)]
    expect(canPlaceOnTableau(destination, [createCard('clubs', 7, true)])).toBe(false)
  })

  it('rejects placing on a card of the same color', () => {
    const destination = [createCard('clubs', 9, true)]
    expect(canPlaceOnTableau(destination, [createCard('spades', 8, true)])).toBe(false)
  })

  it('rejects an invalid moving run even if its base card would fit', () => {
    const destination = [createCard('hearts', 9, true)]
    const invalidRun = [createCard('clubs', 8, true), createCard('spades', 8, true)]
    expect(canPlaceOnTableau(destination, invalidRun)).toBe(false)
  })
})

describe('canPlaceOnFoundation', () => {
  it('allows an Ace on an empty foundation', () => {
    expect(canPlaceOnFoundation([], createCard('hearts', 1, true))).toBe(true)
  })

  it('rejects a non-Ace on an empty foundation', () => {
    expect(canPlaceOnFoundation([], createCard('hearts', 2, true))).toBe(false)
  })

  it('allows the next rank of the same suit', () => {
    const pile = [createCard('hearts', 1, true)]
    expect(canPlaceOnFoundation(pile, createCard('hearts', 2, true))).toBe(true)
  })

  it('rejects a mismatched suit', () => {
    const pile = [createCard('hearts', 1, true)]
    expect(canPlaceOnFoundation(pile, createCard('diamonds', 2, true))).toBe(false)
  })

  it('rejects a skipped rank', () => {
    const pile = [createCard('hearts', 1, true)]
    expect(canPlaceOnFoundation(pile, createCard('hearts', 3, true))).toBe(false)
  })

  it('rejects a face-down card', () => {
    expect(canPlaceOnFoundation([], createCard('hearts', 1, false))).toBe(false)
  })
})
