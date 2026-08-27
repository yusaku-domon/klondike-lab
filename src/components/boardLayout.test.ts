import { describe, expect, it } from 'vitest'
import { emptyState } from '../testFixtures'
import { createCard } from '../domain/cards'
import {
  computeCardPositions,
  computeMovedCardIds,
  DRAG_THRESHOLD_PX,
  exceedsDragThreshold,
  hitTestDropTarget,
  type SlotLayout,
} from './boardLayout'

const CARD_WIDTH_PX = 72
const CARD_HEIGHT_PX = 104

const fakeSlots: SlotLayout = {
  stock: { x: 0, y: 0 },
  waste: { x: 84, y: 0 },
  foundations: {
    clubs: { x: 600, y: 0 },
    diamonds: { x: 684, y: 0 },
    hearts: { x: 768, y: 0 },
    spades: { x: 852, y: 0 },
  },
  tableau: [
    { x: 0, y: 136 },
    { x: 84, y: 136 },
    { x: 168, y: 136 },
    { x: 252, y: 136 },
    { x: 336, y: 136 },
    { x: 420, y: 136 },
    { x: 504, y: 136 },
  ],
}
const STACK_OFFSET_PX = 25.6

describe('computeCardPositions', () => {
  it('stacks every stock card at the measured stock slot, layered by index', () => {
    const stock = [createCard('clubs', 1, false), createCard('clubs', 2, false)]
    const positions = computeCardPositions(emptyState({ stock }), fakeSlots, STACK_OFFSET_PX)

    expect(positions.get('clubs-1')).toEqual({ x: 0, y: 0, z: 0 })
    expect(positions.get('clubs-2')).toEqual({ x: 0, y: 0, z: 1 })
  })

  it('places the waste at the measured waste slot', () => {
    const waste = [createCard('hearts', 5, true)]
    const positions = computeCardPositions(emptyState({ waste }), fakeSlots, STACK_OFFSET_PX)
    expect(positions.get('hearts-5')).toEqual({ x: 84, y: 0, z: 0 })
  })

  it('places each foundation at its own measured slot, regardless of top-row layout', () => {
    const state = emptyState({
      foundations: {
        clubs: [createCard('clubs', 1, true)],
        diamonds: [createCard('diamonds', 1, true)],
        hearts: [createCard('hearts', 1, true)],
        spades: [createCard('spades', 1, true)],
      },
    })
    const positions = computeCardPositions(state, fakeSlots, STACK_OFFSET_PX)

    expect(positions.get('clubs-1')).toEqual({ x: 600, y: 0, z: 0 })
    expect(positions.get('diamonds-1')).toEqual({ x: 684, y: 0, z: 0 })
    expect(positions.get('hearts-1')).toEqual({ x: 768, y: 0, z: 0 })
    expect(positions.get('spades-1')).toEqual({ x: 852, y: 0, z: 0 })
  })

  it('positions tableau cards at their column slot plus the cascading offset', () => {
    const column0 = [createCard('clubs', 10, false), createCard('hearts', 9, true)]
    const state = emptyState({ tableau: [column0, [], [], [], [], [], []] })
    const positions = computeCardPositions(state, fakeSlots, STACK_OFFSET_PX)

    expect(positions.get('clubs-10')).toEqual({ x: 0, y: 136, z: 0 })
    expect(positions.get('hearts-9')).toEqual({ x: 0, y: 136 + STACK_OFFSET_PX, z: 1 })
  })

  it('uses each column slot independently', () => {
    const state = emptyState({
      tableau: [[], [], [], [], [], [], [createCard('spades', 1, true)]],
    })
    const positions = computeCardPositions(state, fakeSlots, STACK_OFFSET_PX)
    expect(positions.get('spades-1')).toEqual({ x: 504, y: 136, z: 0 })
  })
})

describe('computeMovedCardIds', () => {
  it('is empty when nothing changed pile or position', () => {
    const state = emptyState({ waste: [createCard('spades', 13, true)] })
    expect(computeMovedCardIds(state, state)).toEqual(new Set())
  })

  it('flags a single card that moved from waste to a tableau column', () => {
    const before = emptyState({ waste: [createCard('spades', 13, true)] })
    const after = emptyState({ tableau: [[createCard('spades', 13, true)], [], [], [], [], [], []] })

    expect(computeMovedCardIds(before, after)).toEqual(new Set(['spades-13']))
  })

  it('flags every card in a multi-card tableau run that moved together', () => {
    const run = [createCard('clubs', 8, true), createCard('hearts', 7, true)]
    const destinationTop = createCard('hearts', 9, true)
    const before = emptyState({ tableau: [[destinationTop], run, [], [], [], [], []] })
    const after = emptyState({
      tableau: [[destinationTop, ...run], [], [], [], [], [], []],
    })

    expect(computeMovedCardIds(before, after)).toEqual(new Set(['clubs-8', 'hearts-7']))
  })

  it('does not flag a card that only got auto-flipped face up in place', () => {
    const before = emptyState({
      tableau: [[createCard('clubs', 8, false), createCard('hearts', 7, true)], [], [], [], [], [], []],
    })
    const after = emptyState({
      tableau: [[createCard('clubs', 8, true), createCard('hearts', 7, true)], [], [], [], [], [], []],
    })

    // hearts-7 moved away (leaving clubs-8 as the exposed remainder,
    // flipped in place at the same index) — only hearts-7 should be flagged.
    const afterWithMove = emptyState({
      tableau: [[createCard('clubs', 8, true)], [createCard('hearts', 7, true)], [], [], [], [], []],
    })
    expect(computeMovedCardIds(before, afterWithMove)).toEqual(new Set(['hearts-7']))

    // Pure flip with nothing removed above it: no cards moved at all.
    expect(computeMovedCardIds(before, after)).toEqual(new Set())
  })

  it('flags every card when the stock is recycled back from the waste', () => {
    const cards = [createCard('clubs', 1, true), createCard('clubs', 2, true)]
    const before = emptyState({ waste: cards })
    const after = emptyState({ stock: [...cards].reverse().map((c) => ({ ...c, faceUp: false })) })

    expect(computeMovedCardIds(before, after)).toEqual(new Set(['clubs-1', 'clubs-2']))
  })
})

describe('exceedsDragThreshold', () => {
  it('is false for movement under the threshold, in any direction', () => {
    expect(exceedsDragThreshold(0, 0)).toBe(false)
    expect(exceedsDragThreshold(DRAG_THRESHOLD_PX - 1, 0)).toBe(false)
    expect(exceedsDragThreshold(0, -(DRAG_THRESHOLD_PX - 1))).toBe(false)
  })

  it('is true once the straight-line distance reaches the threshold', () => {
    expect(exceedsDragThreshold(DRAG_THRESHOLD_PX, 0)).toBe(true)
    expect(exceedsDragThreshold(0, DRAG_THRESHOLD_PX)).toBe(true)
    expect(exceedsDragThreshold(DRAG_THRESHOLD_PX + 1, DRAG_THRESHOLD_PX + 1)).toBe(true)
  })

  it('combines both axes as a straight-line distance, not per-axis', () => {
    // Neither axis alone reaches an 8px threshold, but the 3-4-5 triangle's
    // hypotenuse (5) still falls short of it — regression guard against an
    // implementation that only checked one axis.
    expect(exceedsDragThreshold(3, 4)).toBe(false)
  })
})

describe('hitTestDropTarget', () => {
  it('finds the foundation slot the point falls inside', () => {
    const point = { x: 684 + 10, y: 10 }
    expect(hitTestDropTarget(point, fakeSlots, CARD_WIDTH_PX, CARD_HEIGHT_PX)).toEqual({
      type: 'foundation',
      suit: 'diamonds',
    })
  })

  it('finds the tableau column whose lane the point falls in, regardless of how far down', () => {
    const nearTop = { x: 252 + 10, y: 136 }
    const farBelowAnyStackedCard = { x: 252 + 10, y: 136 + 2000 }

    expect(hitTestDropTarget(nearTop, fakeSlots, CARD_WIDTH_PX, CARD_HEIGHT_PX)).toEqual({
      type: 'tableau',
      column: 3,
    })
    expect(hitTestDropTarget(farBelowAnyStackedCard, fakeSlots, CARD_WIDTH_PX, CARD_HEIGHT_PX)).toEqual(
      { type: 'tableau', column: 3 },
    )
  })

  it('returns null for a point over the stock or waste (never valid move destinations)', () => {
    expect(hitTestDropTarget({ x: 10, y: 10 }, fakeSlots, CARD_WIDTH_PX, CARD_HEIGHT_PX)).toBeNull()
    expect(hitTestDropTarget({ x: 90, y: 10 }, fakeSlots, CARD_WIDTH_PX, CARD_HEIGHT_PX)).toBeNull()
  })

  it('returns null for a point above the tableau row and outside every foundation slot', () => {
    expect(hitTestDropTarget({ x: 300, y: 10 }, fakeSlots, CARD_WIDTH_PX, CARD_HEIGHT_PX)).toBeNull()
  })
})
