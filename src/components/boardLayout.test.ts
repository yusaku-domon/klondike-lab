import { describe, expect, it } from 'vitest'
import { createCard } from '../domain/cards'
import type { GameState } from '../domain/deal'
import { computeCardPositions, type SlotLayout } from './boardLayout'

function emptyState(overrides: Partial<GameState> = {}): GameState {
  return {
    schemaVersion: 1,
    rulesVersion: 1,
    shuffleVersion: 1,
    scoringVersion: 1,
    seed: 0,
    stock: [],
    waste: [],
    tableau: [[], [], [], [], [], [], []],
    foundations: { clubs: [], diamonds: [], hearts: [], spades: [] },
    score: 0,
    elapsedSeconds: 0,
    status: 'playing',
    moveCount: 0,
    ...overrides,
  }
}

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
