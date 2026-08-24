// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CARD_MOVE_ANIMATION_MS } from '../animationTiming'
import { emptyState } from '../testFixtures'
import { createCard, RANKS } from '../domain/cards'
import type { GameState } from '../domain/deal'
import { useGameStore } from '../stores/game'
import { useSettingsStore } from '../stores/settings'
import GameBoard from './GameBoard.vue'

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

  it('clears a leftover selection when a new game starts, even though the new deal reuses the same pile shape', async () => {
    const { wrapper, store } = mountBoard()
    // Tableau column 6 always ends at cardIndex 6 in any fresh deal, so a
    // stale selection there would otherwise keep resolving to a
    // real-looking (but entirely different) card in the new game.
    store.state = emptyState({
      tableau: [[], [], [], [], [], [], [createCard('spades', 9, true)]],
    })
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-testid="card-spades-9"]').trigger('click')
    expect(wrapper.get('[data-testid="card-spades-9"]').attributes('aria-pressed')).toBe('true')

    store.newGame()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.playing-card.selected').exists()).toBe(false)
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

  describe('moved card stays above other piles while animating', () => {
    it('elevates the moved card above a deeper stationary pile during the transition, then drops back afterward', async () => {
      const { wrapper, store } = mountBoard()
      const deepColumn = [
        createCard('clubs', 10, true),
        createCard('hearts', 9, true),
        createCard('clubs', 8, true),
        createCard('hearts', 7, true),
      ]
      store.state = emptyState({
        waste: [createCard('spades', 1, true)],
        tableau: [deepColumn, [], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()

      await wrapper.get('[data-testid="card-spades-1"]').trigger('click')
      await wrapper.get('[data-testid="foundation-empty-spades"]').trigger('click')
      await wrapper.vm.$nextTick()

      const findZIndex = (ariaLabel: string) => {
        const wrapperDiv = wrapper
          .findAll('.card-wrapper')
          .find((w) => w.find(`[aria-label*="${ariaLabel}"]`).exists())
        return Number(wrapperDiv?.attributes('style')?.match(/z-index:\s*(-?\d+)/)?.[1])
      }

      expect(findZIndex('スペードのA')).toBeGreaterThan(findZIndex('ハートの7'))

      vi.advanceTimersByTime(CARD_MOVE_ANIMATION_MS)
      await wrapper.vm.$nextTick()

      expect(findZIndex('スペードのA')).toBeLessThan(findZIndex('ハートの7'))
    })
  })

  describe('move navigation highlighting', () => {
    function navClasses(wrapper: ReturnType<typeof mount>) {
      return wrapper.findAll('.nav-weak, .nav-strong').map((el) => el.classes())
    }

    function tableauColumnEl(wrapper: ReturnType<typeof mount>, index: number) {
      return wrapper.findAll('.tableau-column')[index]!
    }

    // Looks up a card's classes as rendered by CardAnimationLayer — the
    // actual visible layer (the interactive elements in TableauColumn /
    // FoundationPile / WastePile are invisible `ghost` copies used only
    // for click hit-testing).
    function renderedCardClasses(wrapper: ReturnType<typeof mount>, ariaLabel: string) {
      const cardWrapper = wrapper
        .findAll('.card-wrapper')
        .find((w) => w.find(`[aria-label*="${ariaLabel}"]`).exists())
      return cardWrapper?.find(`[aria-label*="${ariaLabel}"]`).classes() ?? []
    }

    it('shows no highlight at all when nothing is selected', async () => {
      const { wrapper, store } = mountBoard()
      store.state = emptyState({
        waste: [createCard('clubs', 8, true)],
        tableau: [[createCard('hearts', 9, true)], [], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()

      expect(navClasses(wrapper)).toEqual([])
    })

    it('strongly highlights the only legal destination, and nothing else', async () => {
      const { wrapper, store } = mountBoard()
      store.state = emptyState({
        waste: [createCard('clubs', 8, true)],
        tableau: [[createCard('hearts', 9, true)], [], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()

      await wrapper.get('[data-testid="card-clubs-8"]').trigger('click')

      // The destination is column 0's existing top card (hearts-9), not
      // the whole column.
      expect(renderedCardClasses(wrapper, 'ハートの9')).toContain('nav-strong')
      for (let i = 0; i < 7; i++) {
        expect(tableauColumnEl(wrapper, i).classes()).not.toContain('nav-weak')
        expect(tableauColumnEl(wrapper, i).classes()).not.toContain('nav-strong')
      }
      expect(navClasses(wrapper)).toHaveLength(1)
    })

    it('highlights only the receiving card (clubs-6), distinct from the orange selection outline on hearts-5', async () => {
      const { wrapper, store } = mountBoard()
      store.state = emptyState({
        waste: [createCard('hearts', 5, true)],
        tableau: [[createCard('clubs', 6, true)], [], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()

      await wrapper.get('[data-testid="card-hearts-5"]').trigger('click')

      expect(renderedCardClasses(wrapper, 'ハートの5')).toContain('selected')
      expect(renderedCardClasses(wrapper, 'ハートの5')).not.toContain('nav-strong')
      expect(renderedCardClasses(wrapper, 'クラブの6')).toContain('nav-strong')
      expect(renderedCardClasses(wrapper, 'クラブの6')).not.toContain('selected')
      // The whole column no longer lights up — only the card does.
      expect(tableauColumnEl(wrapper, 0).classes()).not.toContain('nav-strong')
      expect(tableauColumnEl(wrapper, 0).classes()).not.toContain('nav-weak')
    })

    it('weakly highlights every legal destination when there is more than one', async () => {
      const { wrapper, store } = mountBoard()
      store.state = emptyState({ waste: [createCard('spades', 13, true)] })
      await wrapper.vm.$nextTick()

      await wrapper.get('[data-testid="card-spades-13"]').trigger('click')

      for (let i = 0; i < 7; i++) {
        expect(tableauColumnEl(wrapper, i).classes()).toContain('nav-weak')
        expect(tableauColumnEl(wrapper, i).classes()).not.toContain('nav-strong')
      }
    })

    it('highlights a legal foundation as the single destination', async () => {
      const { wrapper, store } = mountBoard()
      store.state = emptyState({ waste: [createCard('hearts', 1, true)] })
      await wrapper.vm.$nextTick()

      await wrapper.get('[data-testid="card-hearts-1"]').trigger('click')

      expect(wrapper.get('[data-testid="foundation-empty-hearts"]').classes()).toContain(
        'nav-strong',
      )
      for (const suit of ['clubs', 'diamonds', 'spades']) {
        expect(wrapper.get(`[data-testid="foundation-empty-${suit}"]`).classes()).not.toContain(
          'nav-weak',
        )
      }
      for (let i = 0; i < 7; i++) {
        expect(tableauColumnEl(wrapper, i).classes()).not.toContain('nav-strong')
      }
    })

    it('highlights nothing when the selected card has no legal destination', async () => {
      const { wrapper, store } = mountBoard()
      store.state = emptyState({
        waste: [createCard('hearts', 5, true)],
        tableau: [[createCard('clubs', 9, true)], [], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()

      await wrapper.get('[data-testid="card-hearts-5"]').trigger('click')

      expect(navClasses(wrapper)).toEqual([])
    })

    it('excludes foundations for a multi-card run even though the bottom card alone would fit', async () => {
      const { wrapper, store } = mountBoard()
      const run = [createCard('clubs', 8, true), createCard('hearts', 7, true)]
      store.state = emptyState({
        tableau: [run, [createCard('hearts', 9, true)], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()

      // Selecting the bottom of the run (clubs-8) selects the whole
      // [clubs-8, hearts-7] group, per the existing 2-click selection model.
      await wrapper.get('[data-testid="card-clubs-8"]').trigger('click')

      expect(renderedCardClasses(wrapper, 'ハートの9')).toContain('nav-strong')
      for (const suit of ['clubs', 'diamonds', 'hearts', 'spades']) {
        const el = wrapper.find(`[data-testid="foundation-empty-${suit}"]`)
        if (el.exists()) {
          expect(el.classes()).not.toContain('nav-weak')
          expect(el.classes()).not.toContain('nav-strong')
        }
      }
    })

    it('clears the highlight once a move completes, and recomputes correctly for the next selection', async () => {
      const { wrapper, store } = mountBoard()
      store.state = emptyState({
        waste: [createCard('clubs', 8, true), createCard('hearts', 1, true)],
        tableau: [[createCard('hearts', 9, true)], [], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()

      await wrapper.get('[data-testid="card-hearts-1"]').trigger('click')
      expect(wrapper.get('[data-testid="foundation-empty-hearts"]').classes()).toContain(
        'nav-strong',
      )

      await wrapper.get('[data-testid="foundation-empty-hearts"]').trigger('click')
      await wrapper.vm.$nextTick()
      expect(store.state.foundations.hearts).toHaveLength(1)
      expect(navClasses(wrapper)).toEqual([])

      // Consecutive operation: wait out the move's animation lock, then
      // select the newly exposed waste card and confirm the highlight
      // recomputes for it, not the previous selection.
      vi.advanceTimersByTime(CARD_MOVE_ANIMATION_MS)
      await wrapper.vm.$nextTick()
      await wrapper.get('[data-testid="card-clubs-8"]').trigger('click')
      expect(renderedCardClasses(wrapper, 'ハートの9')).toContain('nav-strong')
    })

    it('produces no highlight and no crash after Undo leaves a stale selection', async () => {
      const { wrapper, store } = mountBoard()
      store.state = emptyState({
        waste: [createCard('clubs', 8, true)],
        tableau: [[createCard('hearts', 9, true)], [], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()

      await wrapper.get('[data-testid="card-clubs-8"]').trigger('click')
      await wrapper.get('[data-testid="card-hearts-9"]').trigger('click')
      await wrapper.vm.$nextTick()
      expect(store.state.tableau[0]).toEqual([
        createCard('hearts', 9, true),
        createCard('clubs', 8, true),
      ])

      store.undo()
      await wrapper.vm.$nextTick()

      expect(store.state.waste).toEqual([createCard('clubs', 8, true)])
      expect(() => navClasses(wrapper)).not.toThrow()
      expect(navClasses(wrapper)).toEqual([])

      // The board is fully usable again after the undo's animation lock clears.
      vi.advanceTimersByTime(CARD_MOVE_ANIMATION_MS)
      await wrapper.vm.$nextTick()
      await wrapper.get('[data-testid="card-clubs-8"]').trigger('click')
      expect(renderedCardClasses(wrapper, 'ハートの9')).toContain('nav-strong')
    })

    it('suppresses all highlighting when the setting is off, but selection and the two-click move still work', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const store = useGameStore()
      const settings = useSettingsStore()
      settings.setMoveNavigationEnabled(false)
      const wrapper = mount(GameBoard, { global: { plugins: [pinia] } })

      store.state = emptyState({
        waste: [createCard('clubs', 8, true)],
        tableau: [[createCard('hearts', 9, true)], [], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()

      await wrapper.get('[data-testid="card-clubs-8"]').trigger('click')
      expect(wrapper.get('[data-testid="card-clubs-8"]').attributes('aria-pressed')).toBe('true')
      expect(navClasses(wrapper)).toEqual([])

      await wrapper.get('[data-testid="card-hearts-9"]').trigger('click')
      await wrapper.vm.$nextTick()

      expect(store.state.tableau[0]).toEqual([
        createCard('hearts', 9, true),
        createCard('clubs', 8, true),
      ])
      expect(store.state.waste).toEqual([])
    })

    it('restores highlighting immediately after the setting is switched back on', async () => {
      const { wrapper, store } = mountBoard()
      const settings = useSettingsStore()
      store.state = emptyState({
        waste: [createCard('clubs', 8, true)],
        tableau: [[createCard('hearts', 9, true)], [], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()

      settings.setMoveNavigationEnabled(false)
      await wrapper.get('[data-testid="card-clubs-8"]').trigger('click')
      await wrapper.vm.$nextTick()
      expect(navClasses(wrapper)).toEqual([])

      settings.setMoveNavigationEnabled(true)
      await wrapper.vm.$nextTick()
      expect(renderedCardClasses(wrapper, 'ハートの9')).toContain('nav-strong')
    })

    it('a fresh store instance restores the persisted OFF setting and shows no highlight (reload simulation)', async () => {
      localStorage.setItem(
        'klondike-lab.settings',
        JSON.stringify({ moveNavigationEnabled: false }),
      )

      const pinia = createPinia()
      setActivePinia(pinia)
      const store = useGameStore()
      const settings = useSettingsStore()
      expect(settings.moveNavigationEnabled).toBe(false)

      const wrapper = mount(GameBoard, { global: { plugins: [pinia] } })
      store.state = emptyState({
        waste: [createCard('clubs', 8, true)],
        tableau: [[createCard('hearts', 9, true)], [], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()

      await wrapper.get('[data-testid="card-clubs-8"]').trigger('click')
      expect(navClasses(wrapper)).toEqual([])
    })
  })
})
