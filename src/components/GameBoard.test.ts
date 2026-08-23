// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CARD_MOVE_ANIMATION_MS } from '../animationTiming'
import { createCard, RANKS } from '../domain/cards'
import type { GameState } from '../domain/deal'
import { useGameStore } from '../stores/game'
import GameBoard from './GameBoard.vue'

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

function mountBoard() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGameStore()
  const wrapper = mount(GameBoard, { global: { plugins: [pinia] } })
  return { wrapper, store }
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('GameBoard', () => {
  it('executes a legal move with two clicks (select, then destination)', async () => {
    const { wrapper, store } = mountBoard()
    store.state = emptyState({ waste: [createCard('spades', 13, true)] })
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-testid="card-spades-13"]').trigger('click')
    await wrapper.get('[data-testid="tableau-empty-0"]').trigger('click')

    expect(store.state.tableau[0]).toEqual([createCard('spades', 13, true)])
    expect(store.state.waste).toEqual([])
  })

  it('leaves the board unchanged and keeps the selection on an illegal move', async () => {
    const { wrapper, store } = mountBoard()
    store.state = emptyState({ waste: [createCard('hearts', 5, true)] })
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-testid="card-hearts-5"]').trigger('click')
    await wrapper.get('[data-testid="tableau-empty-0"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(store.state.waste).toEqual([createCard('hearts', 5, true)])
    expect(store.state.tableau[0]).toEqual([])
    expect(wrapper.get('[data-testid="card-hearts-5"]').attributes('aria-pressed')).toBe('true')
  })

  it('shows and clears selection when the same card is clicked twice', async () => {
    const { wrapper, store } = mountBoard()
    store.state = emptyState({ waste: [createCard('hearts', 5, true)] })
    await wrapper.vm.$nextTick()

    const card = () => wrapper.get('[data-testid="card-hearts-5"]')
    await card().trigger('click')
    expect(card().attributes('aria-pressed')).toBe('true')

    await card().trigger('click')
    expect(card().attributes('aria-pressed')).toBe('false')
  })

  it('shows a win banner and locks out further input once the game is won', async () => {
    const { wrapper, store } = mountBoard()
    store.state = emptyState({
      foundations: {
        clubs: RANKS.map((rank) => createCard('clubs', rank, true)),
        diamonds: RANKS.map((rank) => createCard('diamonds', rank, true)),
        spades: RANKS.map((rank) => createCard('spades', rank, true)),
        hearts: RANKS.slice(0, 12).map((rank) => createCard('hearts', rank, true)),
      },
      tableau: [[createCard('hearts', 13, true)], [], [], [], [], [], []],
    })
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-testid="card-hearts-13"]').trigger('click')
    await wrapper.get('[data-testid="card-hearts-12"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(store.isWon).toBe(true)
    expect(wrapper.find('.win-banner').exists()).toBe(true)

    const moveCountAfterWin = store.state.moveCount
    await wrapper.get('[data-testid="stock-pile"]').trigger('click')

    expect(store.state.moveCount).toBe(moveCountAfterWin)
  })

  it('hides the board and blocks card operations while paused', async () => {
    const { wrapper, store } = mountBoard()
    store.state = emptyState({ stock: [createCard('spades', 13, false)] })
    await wrapper.vm.$nextTick()

    store.pause()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="stock-pile"]').exists()).toBe(false)
    expect(wrapper.find('.pause-overlay').exists()).toBe(true)

    // Even a direct store call is blocked by the board's own guard for regular clicks;
    // simulate the only click surface available while paused: the resume button.
    await wrapper.get('.pause-overlay button').trigger('click')
    await wrapper.vm.$nextTick()

    expect(store.state.status).toBe('playing')
    expect(wrapper.find('[data-testid="stock-pile"]').exists()).toBe(true)
  })

  describe('auto-complete prompt', () => {
    const descendingRanks = [...RANKS].reverse()

    function almostFullyRevealedState(): GameState {
      return emptyState({
        tableau: [
          descendingRanks.map((rank) => createCard('clubs', rank, true)),
          descendingRanks.map((rank) => createCard('diamonds', rank, true)),
          descendingRanks.map((rank) => createCard('hearts', rank, true)),
          descendingRanks.map((rank) => createCard('spades', rank, true)),
          [],
          [],
          [],
        ],
      })
    }

    it('appears the moment the board becomes fully revealed', async () => {
      const { wrapper, store } = mountBoard()
      store.state = emptyState({ stock: [createCard('clubs', 1, false)] })
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.auto-complete-prompt').exists()).toBe(false)

      store.state = almostFullyRevealedState()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.auto-complete-prompt').exists()).toBe(true)
    })

    it('YES runs the cascade and hides the prompt', async () => {
      const { wrapper, store } = mountBoard()
      store.state = almostFullyRevealedState()
      await wrapper.vm.$nextTick()

      await wrapper.get('.auto-complete-prompt button:first-child').trigger('click')
      await wrapper.vm.$nextTick()

      expect(store.isWon).toBe(true)
      expect(wrapper.find('.auto-complete-prompt').exists()).toBe(false)
    })

    it('NO only hides the prompt; the manual button stays available', async () => {
      const { wrapper, store } = mountBoard()
      store.state = almostFullyRevealedState()
      await wrapper.vm.$nextTick()

      await wrapper.get('.auto-complete-prompt button:last-child').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.auto-complete-prompt').exists()).toBe(false)
      expect(store.state.foundations.clubs).toEqual([])
      expect(store.canAutoComplete).toBe(true)
    })

    it('does not reappear after being dismissed just from pausing and resuming', async () => {
      const { wrapper, store } = mountBoard()
      store.state = almostFullyRevealedState()
      await wrapper.vm.$nextTick()
      await wrapper.get('.auto-complete-prompt button:last-child').trigger('click')

      store.pause()
      await wrapper.vm.$nextTick()
      store.resume()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.auto-complete-prompt').exists()).toBe(false)
    })
  })

  describe('input lock during move animation', () => {
    it('ignores a second click while the previous move is still animating, then accepts input again', async () => {
      const { wrapper, store } = mountBoard()
      store.state = emptyState({
        // A face-down card keeps isFullyRevealed false, so the unrelated
        // auto-complete prompt (which would itself block board clicks)
        // never appears and confounds this test.
        stock: [createCard('clubs', 9, false)],
        waste: [createCard('spades', 13, true)],
        tableau: [[], [createCard('hearts', 13, true)], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()

      // First move: waste King -> empty column 0.
      await wrapper.get('[data-testid="card-spades-13"]').trigger('click')
      await wrapper.get('[data-testid="tableau-empty-0"]').trigger('click')
      expect(store.state.tableau[0]).toEqual([createCard('spades', 13, true)])
      expect(store.isAnimating).toBe(true)

      // Second, otherwise-legal move attempted mid-animation must be ignored.
      await wrapper.get('[data-testid="card-hearts-13"]').trigger('click')
      await wrapper.get('[data-testid="tableau-empty-2"]').trigger('click')
      await wrapper.vm.$nextTick()
      expect(store.state.tableau[1]).toEqual([createCard('hearts', 13, true)])
      expect(store.state.tableau[2]).toEqual([])

      vi.advanceTimersByTime(CARD_MOVE_ANIMATION_MS)
      await wrapper.vm.$nextTick()
      expect(store.isAnimating).toBe(false)

      // Now the same move is accepted.
      await wrapper.get('[data-testid="card-hearts-13"]').trigger('click')
      await wrapper.get('[data-testid="tableau-empty-2"]').trigger('click')
      expect(store.state.tableau[1]).toEqual([])
      expect(store.state.tableau[2]).toEqual([createCard('hearts', 13, true)])
    })

    it('also ignores stock clicks while animating', async () => {
      const { wrapper, store } = mountBoard()
      store.state = emptyState({
        stock: [createCard('clubs', 1, false), createCard('clubs', 2, false)],
      })
      await wrapper.vm.$nextTick()

      await wrapper.get('[data-testid="stock-pile"]').trigger('click')
      expect(store.state.waste).toHaveLength(1)

      await wrapper.get('[data-testid="stock-pile"]').trigger('click')
      expect(store.state.waste).toHaveLength(1)

      vi.advanceTimersByTime(CARD_MOVE_ANIMATION_MS)
      await wrapper.get('[data-testid="stock-pile"]').trigger('click')
      expect(store.state.waste).toHaveLength(2)
    })
  })
})
