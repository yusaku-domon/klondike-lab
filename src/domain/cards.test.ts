import { describe, expect, it } from 'vitest'
import { createCard, createCardId, getCardColor } from './cards'

describe('getCardColor', () => {
  it('treats clubs and spades as black', () => {
    expect(getCardColor('clubs')).toBe('black')
    expect(getCardColor('spades')).toBe('black')
  })

  it('treats diamonds and hearts as red', () => {
    expect(getCardColor('diamonds')).toBe('red')
    expect(getCardColor('hearts')).toBe('red')
  })
})

describe('createCardId', () => {
  it('formats as "<suit>-<rank>"', () => {
    expect(createCardId('hearts', 13)).toBe('hearts-13')
    expect(createCardId('clubs', 1)).toBe('clubs-1')
  })
})

describe('createCard', () => {
  it('defaults faceUp to false', () => {
    const card = createCard('spades', 7)
    expect(card).toEqual({ id: 'spades-7', suit: 'spades', rank: 7, faceUp: false })
  })

  it('accepts an explicit faceUp value', () => {
    const card = createCard('diamonds', 1, true)
    expect(card.faceUp).toBe(true)
  })
})
