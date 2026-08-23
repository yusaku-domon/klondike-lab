// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createCard } from '../domain/cards'
import type { GameState } from '../domain/deal'
import CardAnimationLayer from './CardAnimationLayer.vue'

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

function domIndexOf(wrapper: ReturnType<typeof mount>, ariaLabel: string): number {
  const wrappers = wrapper.findAll('.card-wrapper')
  return wrappers.findIndex((w) => w.find(`[aria-label*="${ariaLabel}"]`).exists())
}

describe('CardAnimationLayer', () => {
  it('renders every canonical card slot, always in the same fixed order', () => {
    const wrapper = mount(CardAnimationLayer, {
      props: {
        state: emptyState({ waste: [createCard('hearts', 1, true)] }),
        positions: new Map(),
        selectedCardIds: new Set(),
      },
    })

    expect(wrapper.findAll('.card-wrapper')).toHaveLength(52)
  })

  it('keeps a card at the same DOM position when it moves to a different pile, so its transition never restarts', async () => {
    const wrapper = mount(CardAnimationLayer, {
      props: {
        state: emptyState({
          tableau: [[createCard('hearts', 1, true)], [], [], [], [], [], []],
        }),
        positions: new Map(),
        selectedCardIds: new Set(),
      },
    })

    const indexInTableau = domIndexOf(wrapper, 'ハートのA')
    expect(indexInTableau).toBeGreaterThanOrEqual(0)

    // Move the same card from tableau to a foundation (a different pile
    // category, which used to change its position in the flattened list).
    await wrapper.setProps({
      state: emptyState({
        foundations: { clubs: [], diamonds: [], hearts: [createCard('hearts', 1, true)], spades: [] },
      }),
    })

    const indexInFoundation = domIndexOf(wrapper, 'ハートのA')
    expect(indexInFoundation).toBe(indexInTableau)
  })
})
