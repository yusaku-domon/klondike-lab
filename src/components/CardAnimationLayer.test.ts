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

    const indexInTableau = domIndexOf(wrapper, 'A of Hearts')
    expect(indexInTableau).toBeGreaterThanOrEqual(0)

    // Move the same card from tableau to a foundation (a different pile
    // category, which used to change its position in the flattened list).
    await wrapper.setProps({
      state: emptyState({
        foundations: { clubs: [], diamonds: [], hearts: [createCard('hearts', 1, true)], spades: [] },
      }),
    })

    const indexInFoundation = domIndexOf(wrapper, 'A of Hearts')
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
    expect(zIndexOf(notAnimating, 'A of Spades')).toBe(0)

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
    expect(zIndexOf(animating, 'A of Spades')).toBeGreaterThan(zIndexOf(animating, '7 of Hearts'))
    // And it's back to its normal (lower) stacking once not animating.
    expect(zIndexOf(notAnimating, 'A of Spades')).toBeLessThan(zIndexOf(notAnimating, '7 of Hearts'))
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

    expect(classesOf(wrapper, '6 of Clubs')).toContain('nav-strong')
    expect(classesOf(wrapper, '9 of Hearts')).not.toContain('nav-weak')
    expect(classesOf(wrapper, '9 of Hearts')).not.toContain('nav-strong')
  })

  function transitionDurationOf(wrapper: ReturnType<typeof mount>, ariaLabel: string): string | undefined {
    const wrappers = wrapper.findAll('.card-wrapper')
    const el = wrappers.find((w) => w.find(`[aria-label*="${ariaLabel}"]`).exists())
    return el?.attributes('style')?.match(/transition-duration:\s*([^;]+);/)?.[1]
  }

  it('removes the transition for a dragging card so it tracks the pointer with no lag, leaving everything else animated', () => {
    const state = emptyState({
      tableau: [[createCard('hearts', 9, true)], [createCard('clubs', 6, true)], [], [], [], [], []],
    })

    const wrapper = mount(CardAnimationLayer, {
      props: {
        state,
        positions: new Map(),
        selectedCardIds: new Set<string>(),
        animatingCardIds: new Set<string>(),
        draggingCardIds: new Set(['hearts-9']),
        destinationHighlights: new Map(),
        animationDurationMs: CARD_MOVE_ANIMATION_MS,
      },
    })

    expect(transitionDurationOf(wrapper, '9 of Hearts')).toBe('0ms')
    expect(transitionDurationOf(wrapper, '6 of Clubs')).toBe(`${CARD_MOVE_ANIMATION_MS}ms`)
  })

  it('defaults every card to the normal animation duration when draggingCardIds is omitted', () => {
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

    expect(transitionDurationOf(wrapper, 'A of Hearts')).toBe(`${CARD_MOVE_ANIMATION_MS}ms`)
  })
})
