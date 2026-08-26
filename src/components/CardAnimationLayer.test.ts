// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { emptyState } from '../testFixtures'
import { CARD_MOVE_ANIMATION_MS } from '../animationTiming'
import { createCard } from '../domain/cards'
import CardAnimationLayer from './CardAnimationLayer.vue'

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
        selectedCardIds: new Set<string>(),
        animatingCardIds: new Set<string>(),
        destinationHighlights: new Map(),
        animationDurationMs: CARD_MOVE_ANIMATION_MS,
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
        selectedCardIds: new Set<string>(),
        animatingCardIds: new Set<string>(),
        destinationHighlights: new Map(),
        animationDurationMs: CARD_MOVE_ANIMATION_MS,
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

  function zIndexOf(wrapper: ReturnType<typeof mount>, ariaLabel: string): number {
    const wrappers = wrapper.findAll('.card-wrapper')
    const el = wrappers.find((w) => w.find(`[aria-label*="${ariaLabel}"]`).exists())
    return Number(el?.attributes('style')?.match(/z-index:\s*(-?\d+)/)?.[1])
  }

  it('renders an animating card far above a stationary card with a higher in-pile z, and drops back once no longer animating', () => {
    const deepColumn = [
      createCard('clubs', 10, true),
      createCard('hearts', 9, true),
      createCard('clubs', 8, true),
      createCard('hearts', 7, true),
    ]
    const state = emptyState({
      tableau: [deepColumn, [createCard('spades', 1, true)], [], [], [], [], []],
    })
    const positions = new Map([
      ['clubs-10', { x: 0, y: 0, z: 0 }],
      ['hearts-9', { x: 0, y: 26, z: 1 }],
      ['clubs-8', { x: 0, y: 52, z: 2 }],
      ['hearts-7', { x: 0, y: 78, z: 3 }],
      ['spades-1', { x: 84, y: 0, z: 0 }],
    ])

    const notAnimating = mount(CardAnimationLayer, {
      props: {
        state,
        positions,
        selectedCardIds: new Set<string>(),
        animatingCardIds: new Set<string>(),
        destinationHighlights: new Map(),
        animationDurationMs: CARD_MOVE_ANIMATION_MS,
      },
    })
    expect(zIndexOf(notAnimating, 'スペードのA')).toBe(0)

    const animating = mount(CardAnimationLayer, {
      props: {
        state,
        positions,
        selectedCardIds: new Set<string>(),
        animatingCardIds: new Set(['spades-1']),
        destinationHighlights: new Map(),
        animationDurationMs: CARD_MOVE_ANIMATION_MS,
      },
    })
    // spades-1 has the LOWEST in-pile z (0) of everyone on the board, yet
    // while animating it must still render above hearts-7 (in-pile z 3,
    // the deepest/topmost card of the other column).
    expect(zIndexOf(animating, 'スペードのA')).toBeGreaterThan(zIndexOf(animating, 'ハートの7'))
    // And it's back to its normal (lower) stacking once not animating.
    expect(zIndexOf(notAnimating, 'スペードのA')).toBeLessThan(zIndexOf(notAnimating, 'ハートの7'))
  })

  function classesOf(wrapper: ReturnType<typeof mount>, ariaLabel: string): string[] | undefined {
    const wrappers = wrapper.findAll('.card-wrapper')
    const el = wrappers.find((w) => w.find(`[aria-label*="${ariaLabel}"]`).exists())
    return el?.find(`[aria-label*="${ariaLabel}"]`).classes()
  }

  it('applies a move-navigation class to exactly the card flagged in destinationHighlights', () => {
    const state = emptyState({
      tableau: [
        [createCard('hearts', 9, true)],
        [createCard('clubs', 6, true)],
        [],
        [],
        [],
        [],
        [],
      ],
    })

    const wrapper = mount(CardAnimationLayer, {
      props: {
        state,
        positions: new Map(),
        selectedCardIds: new Set<string>(),
        animatingCardIds: new Set<string>(),
        destinationHighlights: new Map<string, 'weak' | 'strong'>([['clubs-6', 'strong']]),
        animationDurationMs: CARD_MOVE_ANIMATION_MS,
      },
    })

    expect(classesOf(wrapper, 'クラブの6')).toContain('nav-strong')
    expect(classesOf(wrapper, 'ハートの9')).not.toContain('nav-weak')
    expect(classesOf(wrapper, 'ハートの9')).not.toContain('nav-strong')
  })
})
