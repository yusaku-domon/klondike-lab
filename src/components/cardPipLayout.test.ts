import { describe, expect, it } from 'vitest'
import { PIP_LAYOUTS } from './cardPipLayout'

describe('PIP_LAYOUTS', () => {
  it('has an entry for every number rank 2 through 10, and no others', () => {
    const ranks = Object.keys(PIP_LAYOUTS).map(Number).sort((a, b) => a - b)
    expect(ranks).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('gives each rank exactly as many pips as its number', () => {
    for (const [rank, positions] of Object.entries(PIP_LAYOUTS)) {
      expect(positions).toHaveLength(Number(rank))
    }
  })

  it('keeps every pip within the 0-100% grid on both axes', () => {
    for (const positions of Object.values(PIP_LAYOUTS)) {
      for (const { x, y } of positions!) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(100)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(100)
      }
    }
  })

  it('rotates exactly the pips in the bottom half (y > 50), leaving the rest upright', () => {
    for (const positions of Object.values(PIP_LAYOUTS)) {
      for (const { y, rotated } of positions!) {
        expect(Boolean(rotated)).toBe(y > 50)
      }
    }
  })

  it('is point-symmetric: every pip has a matching mirrored pip on the opposite side', () => {
    // Reflecting (x, y) through the card's center (50, 50) must land on
    // another entry in the same layout — the traditional guarantee that a
    // pip card looks identical read from either end.
    for (const positions of Object.values(PIP_LAYOUTS)) {
      for (const { x, y } of positions!) {
        const mirroredX = 100 - x
        const mirroredY = 100 - y
        const hasMirror = positions!.some((p) => p.x === mirroredX && p.y === mirroredY)
        expect(hasMirror).toBe(true)
      }
    }
  })
})
