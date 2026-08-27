// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS, CARD_MOVE_ANIMATION_MS } from '../animationTiming'
import { emptyState } from '../testFixtures'
import { createCard, RANKS, type Card } from '../domain/cards'
import type { GameState } from '../domain/deal'
import { isCompleteUniqueDeck } from '../domain/invariants'
import { saveGame } from '../persistence/gameStorage'
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

  it('keeps the board visible (grayed out) and still blocks card operations while paused', async () => {
    const { wrapper, store } = mountBoard()
    store.state = emptyState({ stock: [createCard('spades', 13, false)] })
    await wrapper.vm.$nextTick()

    store.pause()
    await wrapper.vm.$nextTick()

    // The board the player paused on stays visible underneath the overlay...
    expect(wrapper.find('[data-testid="stock-pile"]').exists()).toBe(true)
    expect(wrapper.find('.pause-overlay').exists()).toBe(true)

    // ...but clicking it still has no effect while paused.
    await wrapper.get('[data-testid="stock-pile"]').trigger('click')
    expect(store.state.stock).toHaveLength(1)

    // The only working click surface while paused is the resume button.
    await wrapper.get('.pause-overlay button').trigger('click')
    await wrapper.vm.$nextTick()

    expect(store.state.status).toBe('playing')
    expect(wrapper.find('.pause-overlay').exists()).toBe(false)
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
      store.state = emptyState({
        tableau: [[createCard('clubs', 1, false)], [], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.auto-complete-prompt').exists()).toBe(false)

      store.state = almostFullyRevealedState()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.auto-complete-prompt').exists()).toBe(true)
    })

    it('appears even while the stock/waste still have cards, as long as the tableau is fully revealed', async () => {
      const { wrapper, store } = mountBoard()
      store.state = emptyState({
        tableau: [[createCard('clubs', 1, false)], [], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()

      store.state = emptyState({
        stock: [createCard('spades', 5, false)],
        waste: [createCard('spades', 1, true)],
        tableau: [[createCard('clubs', 1, true)], [], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.auto-complete-prompt').exists()).toBe(true)
    })

    it('YES hides the prompt immediately, then runs the cascade to completion', async () => {
      const { wrapper, store } = mountBoard()
      store.state = almostFullyRevealedState()
      await wrapper.vm.$nextTick()

      await wrapper.get('.auto-complete-prompt button:first-child').trigger('click')
      await wrapper.vm.$nextTick()

      // The prompt itself closes right away — it doesn't wait for the
      // (multi-second) cascade to actually finish.
      expect(wrapper.find('.auto-complete-prompt').exists()).toBe(false)
      expect(store.isWon).toBe(false)

      await vi.advanceTimersByTimeAsync(52 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await wrapper.vm.$nextTick()

      expect(store.isWon).toBe(true)
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

    it('appears on mount for a game restored from localStorage that was already fully revealed when saved', async () => {
      // Simulates quitting right after revealing the last tableau card (or
      // even mid-cascade with stock/waste still holding cards) and coming
      // back later: there is no false→true transition to observe here
      // since the board is revealed from the very first tick, so this only
      // works if the prompt watch also checks the state it starts with.
      localStorage.clear()
      saveGame(almostFullyRevealedState())

      const { wrapper, store } = mountBoard()
      await wrapper.vm.$nextTick()

      expect(store.canAutoComplete).toBe(true)
      expect(wrapper.find('.auto-complete-prompt').exists()).toBe(true)
    })

    it('does not appear on mount for a freshly restored game that still has a face-down tableau card', async () => {
      localStorage.clear()
      saveGame(
        emptyState({
          tableau: [[createCard('clubs', 1, false)], [], [], [], [], [], []],
        }),
      )

      const { wrapper, store } = mountBoard()
      await wrapper.vm.$nextTick()

      expect(store.canAutoComplete).toBe(false)
      expect(wrapper.find('.auto-complete-prompt').exists()).toBe(false)
    })
  })

  describe('input lock during move animation', () => {
    it('ignores a second click while the previous move is still animating, then accepts input again', async () => {
      const { wrapper, store } = mountBoard()
      store.state = emptyState({
        // A face-down tableau card keeps isFullyRevealed false (it no
        // longer looks at the stock at all), so the unrelated
        // auto-complete prompt (which would itself block board clicks)
        // never appears and confounds this test.
        waste: [createCard('spades', 13, true)],
        tableau: [[], [createCard('hearts', 13, true)], [], [], [], [], [createCard('clubs', 9, false)]],
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

      expect(findZIndex('A of Spades')).toBeGreaterThan(findZIndex('7 of Hearts'))

      vi.advanceTimersByTime(CARD_MOVE_ANIMATION_MS)
      await wrapper.vm.$nextTick()

      expect(findZIndex('A of Spades')).toBeLessThan(findZIndex('7 of Hearts'))
    })
  })

  describe('auto-complete cascade animation', () => {
    function findZIndex(wrapper: ReturnType<typeof mount>, ariaLabel: string) {
      const wrapperDiv = wrapper
        .findAll('.card-wrapper')
        .find((w) => w.find(`[aria-label*="${ariaLabel}"]`).exists())
      return Number(wrapperDiv?.attributes('style')?.match(/z-index:\s*(-?\d+)/)?.[1])
    }

    function twoCardCascadeState(): GameState {
      return emptyState({
        foundations: { clubs: [createCard('clubs', 4, true)], diamonds: [], hearts: [], spades: [] },
        tableau: [
          [createCard('hearts', 9, true), createCard('clubs', 5, true)],
          [createCard('hearts', 1, true)],
          [],
          [],
          [],
          [],
          [],
        ],
      })
    }

    it('moves one card at a time — the next card only starts once the previous one has landed', async () => {
      const { wrapper, store } = mountBoard()
      store.state = twoCardCascadeState()
      await wrapper.vm.$nextTick()

      store.autoComplete()
      await wrapper.vm.$nextTick()

      // First tick: clubs-5 is elevated (mid-move) and already relocated in
      // state; hearts-1 has not moved yet — no simultaneous movement.
      expect(findZIndex(wrapper, '5 of Clubs')).toBeGreaterThan(findZIndex(wrapper, '9 of Hearts'))
      expect(store.state.foundations.clubs).toEqual([
        createCard('clubs', 4, true),
        createCard('clubs', 5, true),
      ])
      expect(store.state.tableau[1]).toEqual([createCard('hearts', 1, true)])

      await vi.advanceTimersByTimeAsync(AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await wrapper.vm.$nextTick()

      // clubs-5's elevation has dropped back — it's no longer mid-move —
      // and hearts-1 is now the one elevated, confirming the two moves
      // never overlapped.
      expect(findZIndex(wrapper, 'A of Hearts')).toBeGreaterThan(findZIndex(wrapper, '9 of Hearts'))
      expect(store.state.tableau[1]).toEqual([])

      await vi.advanceTimersByTimeAsync(AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await wrapper.vm.$nextTick()

      expect(store.state.foundations.hearts).toEqual([createCard('hearts', 1, true)])
    })

    function findTransitionDuration(wrapper: ReturnType<typeof mount>, ariaLabel: string) {
      const wrapperDiv = wrapper
        .findAll('.card-wrapper')
        .find((w) => w.find(`[aria-label*="${ariaLabel}"]`).exists())
      return wrapperDiv?.attributes('style')?.match(/transition-duration:\s*([\d.]+)ms/)?.[1]
    }

    it('animates cascade steps at the faster auto-complete duration, not the normal move duration', async () => {
      const { wrapper, store } = mountBoard()
      store.state = twoCardCascadeState()
      await wrapper.vm.$nextTick()

      store.autoComplete()
      await wrapper.vm.$nextTick()

      expect(store.isAutoCompleting).toBe(true)
      expect(findTransitionDuration(wrapper, '5 of Clubs')).toBe(
        String(AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS),
      )

      await vi.advanceTimersByTimeAsync(2 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await wrapper.vm.$nextTick()

      expect(store.isAutoCompleting).toBe(false)
    })

    it('leaves a normal manual move at its usual (slower) duration, unaffected by the auto-complete constant', async () => {
      const { wrapper, store } = mountBoard()
      store.state = emptyState({
        waste: [createCard('spades', 1, true)],
        tableau: [[], [], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()

      await wrapper.get('[data-testid="card-spades-1"]').trigger('click')
      await wrapper.get('[data-testid="foundation-empty-spades"]').trigger('click')
      await wrapper.vm.$nextTick()

      expect(store.isAutoCompleting).toBe(false)
      expect(findTransitionDuration(wrapper, 'A of Spades')).toBe(String(CARD_MOVE_ANIMATION_MS))
    })

    it('blocks manual clicks and a second auto-complete trigger for the whole cascade', async () => {
      const { wrapper, store } = mountBoard()
      store.state = twoCardCascadeState()
      await wrapper.vm.$nextTick()

      store.autoComplete()
      await wrapper.vm.$nextTick()
      expect(store.isAnimating).toBe(true)

      // A manual click on an unrelated, otherwise-legal target is ignored.
      await wrapper.get('[data-testid="card-hearts-1"]').trigger('click')
      expect(store.state.tableau[1]).toEqual([createCard('hearts', 1, true)])

      // The toolbar's own button click is also a no-op mid-cascade.
      const before = store.state
      store.autoComplete()
      await wrapper.vm.$nextTick()
      expect(store.state).toBe(before)

      await vi.advanceTimersByTimeAsync(2 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await wrapper.vm.$nextTick()

      expect(store.isAnimating).toBe(false)
      expect(store.state.foundations.hearts).toEqual([createCard('hearts', 1, true)])
    })

    it('shows the win banner only once the very last card has landed, not partway through', async () => {
      const { wrapper, store } = mountBoard()
      const descendingRanks = [...RANKS].reverse()
      store.state = emptyState({
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
      await wrapper.vm.$nextTick()

      store.autoComplete()
      await wrapper.vm.$nextTick()

      // Partway through the 52-card cascade: not won yet, no banner.
      await vi.advanceTimersByTimeAsync(10 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await wrapper.vm.$nextTick()
      expect(store.isWon).toBe(false)
      expect(wrapper.find('.win-banner').exists()).toBe(false)

      await vi.advanceTimersByTimeAsync(52 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await wrapper.vm.$nextTick()

      expect(store.isWon).toBe(true)
      expect(wrapper.find('.win-banner').exists()).toBe(true)
    })

    it('completes a large cascade that also has to draw and flip an entire suit out of the stock', async () => {
      // Previously only exercised at the pure-domain level and, inconclusively,
      // in a live browser (real per-step rendering overhead in that specific
      // automation environment made a 65-step run too slow to watch to
      // completion there). This drives the exact same scenario through the
      // real component/store stack — GameBoard's animation watcher,
      // CardAnimationLayer, the win-banner template — with fake timers, so
      // it's exact and instant regardless of real-world rendering speed.
      const descendingRanks = [...RANKS].reverse()
      const { wrapper, store } = mountBoard()
      store.state = emptyState({
        tableau: [
          descendingRanks.map((rank) => createCard('clubs', rank, true)),
          descendingRanks.map((rank) => createCard('diamonds', rank, true)),
          descendingRanks.map((rank) => createCard('hearts', rank, true)),
          [],
          [],
          [],
          [],
        ],
        // stock.pop() draws the last element first, so spades-1 is drawn
        // before spades-2, ..., before spades-13 — a clean single pass with
        // no recycling needed, mirroring the earlier live-browser scenario.
        stock: descendingRanks.map((rank) => createCard('spades', rank, false)),
      })
      await wrapper.vm.$nextTick()
      expect(store.canAutoComplete).toBe(true)

      function allCards(state: GameState): Card[] {
        return [
          ...state.stock,
          ...state.waste,
          ...state.tableau.flat(),
          ...Object.values(state.foundations).flat(),
        ]
      }

      const done = store.autoComplete()
      await wrapper.vm.$nextTick()

      // Partway through (tableau alone is 39 moves): not won, no banner,
      // and the deck is still exactly 52 unique cards — nothing lost or
      // duplicated mid-cascade.
      await vi.advanceTimersByTimeAsync(20 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await wrapper.vm.$nextTick()
      expect(store.isWon).toBe(false)
      expect(wrapper.find('.win-banner').exists()).toBe(false)
      expect(isCompleteUniqueDeck(allCards(store.state))).toBe(true)

      // Still not done: the stock hasn't been touched yet at this point.
      await vi.advanceTimersByTimeAsync(40 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await wrapper.vm.$nextTick()
      expect(store.isWon).toBe(false)
      expect(wrapper.find('.win-banner').exists()).toBe(false)

      // 39 tableau moves + 13 draws + 13 foundation placements = 65 steps.
      await vi.advanceTimersByTimeAsync(65 * AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
      await done
      await wrapper.vm.$nextTick()

      expect(store.isWon).toBe(true)
      expect(wrapper.find('.win-banner').exists()).toBe(true)
      expect(store.isAnimating).toBe(false)
      expect(store.state.stock).toEqual([])
      expect(store.state.waste).toEqual([])
      expect(store.state.tableau.every((column) => column.length === 0)).toBe(true)
      for (const suit of ['clubs', 'diamonds', 'hearts', 'spades'] as const) {
        expect(store.state.foundations[suit]).toHaveLength(13)
      }
      expect(isCompleteUniqueDeck(allCards(store.state))).toBe(true)
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
      expect(renderedCardClasses(wrapper, '9 of Hearts')).toContain('nav-strong')
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

      expect(renderedCardClasses(wrapper, '5 of Hearts')).toContain('selected')
      expect(renderedCardClasses(wrapper, '5 of Hearts')).not.toContain('nav-strong')
      expect(renderedCardClasses(wrapper, '6 of Clubs')).toContain('nav-strong')
      expect(renderedCardClasses(wrapper, '6 of Clubs')).not.toContain('selected')
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

      expect(renderedCardClasses(wrapper, '9 of Hearts')).toContain('nav-strong')
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
      expect(renderedCardClasses(wrapper, '9 of Hearts')).toContain('nav-strong')
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
      expect(renderedCardClasses(wrapper, '9 of Hearts')).toContain('nav-strong')
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
      expect(renderedCardClasses(wrapper, '9 of Hearts')).toContain('nav-strong')
    })

    it('a fresh store instance restores the persisted OFF setting and shows no highlight (reload simulation)', async () => {
      localStorage.setItem(
        'klondike-lab.settings',
        JSON.stringify({ moveNavigationEnabled: false, cardDesign: 'classic' }),
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

  describe('drag-to-move', () => {
    const CARD_W = 72
    const CARD_H = 104
    const PITCH = 84 // card width + the fixed test gap between slots

    // GameBoard measures real layout via getBoundingClientRect, which
    // jsdom always reports as all-zero — fine for the click-based tests
    // above (they never read coordinates), but drag hit-testing needs
    // real, distinguishable slot rects. Position is derived purely from a
    // slot's index among its `.pile-slot` siblings, so this doesn't care
    // which specific piles exist in a given test's state.
    function mockPileRects() {
      return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement,
      ) {
        const empty = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }
        if (this.classList?.contains('game-board')) {
          return { ...empty, right: 900, bottom: 600, width: 900, height: 600 }
        }
        if (this.classList?.contains('pile-slot')) {
          const parent = this.parentElement
          if (!parent) return empty
          const pileSlots = Array.from(parent.children).filter((el) => el.classList.contains('pile-slot'))
          const index = pileSlots.indexOf(this)
          const y = parent.classList.contains('tableau-row') ? 200 : 0
          const x = index * PITCH
          return { ...empty, left: x, top: y, right: x + CARD_W, bottom: y + CARD_H, width: CARD_W, height: CARD_H, x, y }
        }
        return empty
      }) as unknown as ReturnType<typeof vi.spyOn>
    }

    let rectSpy: ReturnType<typeof mockPileRects>
    let activeWrapper: ReturnType<typeof mount> | null = null

    beforeEach(() => {
      rectSpy = mockPileRects()
    })

    afterEach(() => {
      rectSpy.mockRestore()
      // Real DOM connectivity (attachTo: document.body) is what lets a
      // dispatched pointer event bubble up to this feature's
      // window-level move/up listeners — but that means each mounted
      // board must also be torn down, or a leftover instance's listeners
      // (and stale nodes) bleed into the next test.
      activeWrapper?.unmount()
      activeWrapper = null
      document.body.innerHTML = ''
    })

    function mountAttachedBoard() {
      const pinia = createPinia()
      setActivePinia(pinia)
      const store = useGameStore()
      const wrapper = mount(GameBoard, { global: { plugins: [pinia] }, attachTo: document.body })
      activeWrapper = wrapper
      return { wrapper, store }
    }

    // Top row order: stock(0) waste(1) clubs(2) diamonds(3) hearts(4) spades(5) → y=0
    const WASTE_X = 1 * PITCH
    const FOUNDATION_X: Record<'clubs' | 'diamonds' | 'hearts' | 'spades', number> = {
      clubs: 2 * PITCH,
      diamonds: 3 * PITCH,
      hearts: 4 * PITCH,
      spades: 5 * PITCH,
    }
    const TABLEAU_Y = 200

    // vue-test-utils' trigger() can't set clientX/clientY on a jsdom
    // MouseEvent (they're getter-only on the prototype, so its generic
    // property-copy throws) — construct the event ourselves instead,
    // setting clientX/clientY via the constructor (which does work) and
    // pointerId as a plain extra property.
    function firePointerEvent(
      el: Element,
      type: 'pointerdown' | 'pointermove' | 'pointerup',
      point: { x: number; y: number },
      pointerId = 1,
    ) {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y })
      Object.defineProperty(event, 'pointerId', { value: pointerId })
      el.dispatchEvent(event)
    }

    async function drag(
      wrapper: ReturnType<typeof mountAttachedBoard>['wrapper'],
      fromTestId: string,
      from: { x: number; y: number },
      to: { x: number; y: number },
    ) {
      const el = wrapper.get(`[data-testid="${fromTestId}"]`).element
      firePointerEvent(el, 'pointerdown', from)
      firePointerEvent(el, 'pointermove', to)
      firePointerEvent(el, 'pointerup', to)
      await wrapper.vm.$nextTick()
    }

    it('drags a waste card onto a legal foundation and applies the move', async () => {
      const { wrapper, store } = mountAttachedBoard()
      store.state = emptyState({ waste: [createCard('hearts', 1, true)] })
      await wrapper.vm.$nextTick()

      await drag(
        wrapper,
        'card-hearts-1',
        { x: WASTE_X + 10, y: 10 },
        { x: FOUNDATION_X.hearts + 10, y: 10 },
      )

      expect(store.state.foundations.hearts).toEqual([createCard('hearts', 1, true)])
      expect(store.state.waste).toEqual([])
    })

    it('leaves the board unchanged when dropped on an illegal destination', async () => {
      const { wrapper, store } = mountAttachedBoard()
      store.state = emptyState({ waste: [createCard('hearts', 1, true)] })
      await wrapper.vm.$nextTick()

      // Wrong suit for the clubs foundation.
      await drag(
        wrapper,
        'card-hearts-1',
        { x: WASTE_X + 10, y: 10 },
        { x: FOUNDATION_X.clubs + 10, y: 10 },
      )

      expect(store.state.waste).toEqual([createCard('hearts', 1, true)])
      expect(store.state.foundations.clubs).toEqual([])
    })

    it('drags a tableau card onto an empty column', async () => {
      const { wrapper, store } = mountAttachedBoard()
      store.state = emptyState({
        tableau: [[createCard('clubs', 13, true)], [], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()

      await drag(
        wrapper,
        'card-clubs-13',
        { x: 0 * PITCH + 10, y: TABLEAU_Y + 10 },
        { x: 1 * PITCH + 10, y: TABLEAU_Y + 10 },
      )

      expect(store.state.tableau[0]).toEqual([])
      expect(store.state.tableau[1]).toEqual([createCard('clubs', 13, true)])
    })

    it('drops anywhere in a column below its slot, not just on its top card', async () => {
      const { wrapper, store } = mountAttachedBoard()
      store.state = emptyState({
        tableau: [[createCard('clubs', 13, true)], [], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()

      await drag(
        wrapper,
        'card-clubs-13',
        { x: 0 * PITCH + 10, y: TABLEAU_Y + 10 },
        { x: 1 * PITCH + 10, y: TABLEAU_Y + 2000 },
      )

      expect(store.state.tableau[1]).toEqual([createCard('clubs', 13, true)])
    })

    it('does not start a drag for a non-draggable source, and applying no move leaves state untouched', async () => {
      const { wrapper, store } = mountAttachedBoard()
      store.state = emptyState({ stock: [createCard('spades', 1, false)] })
      await wrapper.vm.$nextTick()
      const before = store.state

      await drag(
        wrapper,
        'stock-pile',
        { x: 10, y: 10 },
        { x: FOUNDATION_X.spades + 10, y: 10 },
      )

      expect(store.state).toBe(before)
    })

    it('movement under the threshold is a tap, not a drag: the click that follows still selects normally', async () => {
      const { wrapper, store } = mountAttachedBoard()
      store.state = emptyState({ waste: [createCard('hearts', 5, true)] })
      await wrapper.vm.$nextTick()

      const card = wrapper.get('[data-testid="card-hearts-5"]')
      firePointerEvent(card.element, 'pointerdown', { x: WASTE_X + 10, y: 10 })
      firePointerEvent(card.element, 'pointermove', { x: WASTE_X + 12, y: 11 })
      firePointerEvent(card.element, 'pointerup', { x: WASTE_X + 12, y: 11 })
      await wrapper.vm.$nextTick()
      await card.trigger('click')

      expect(card.attributes('aria-pressed')).toBe('true')
      expect(store.state.waste).toEqual([createCard('hearts', 5, true)])
    })

    it('highlights the legal destination while a drag is in progress, before it is dropped', async () => {
      const { wrapper, store } = mountAttachedBoard()
      store.state = emptyState({ waste: [createCard('hearts', 1, true)] })
      await wrapper.vm.$nextTick()

      const card = wrapper.get('[data-testid="card-hearts-1"]')
      firePointerEvent(card.element, 'pointerdown', { x: WASTE_X + 10, y: 10 })
      firePointerEvent(card.element, 'pointermove', { x: FOUNDATION_X.hearts + 10, y: 10 })
      await wrapper.vm.$nextTick()

      // An ace has exactly one legal destination (its own empty foundation
      // — an empty tableau column only ever accepts a King), so this
      // should be the 'strong' single-destination highlight.
      expect(wrapper.get('[data-testid="foundation-empty-hearts"]').classes()).toContain('nav-strong')
    })

    it('does not suppress a later, unrelated click after a drag is dropped on background with no click handler', async () => {
      const { wrapper, store } = mountAttachedBoard()
      store.state = emptyState({
        waste: [createCard('hearts', 5, true)],
        tableau: [[createCard('clubs', 8, true)], [], [], [], [], [], []],
      })
      await wrapper.vm.$nextTick()

      // Dropped between the waste slot and the first foundation slot — the
      // spacer has no click handler and isn't a valid drop target, so
      // nothing here would naturally consume the suppression flag.
      await drag(
        wrapper,
        'card-hearts-5',
        { x: WASTE_X + 10, y: 10 },
        { x: WASTE_X + PITCH - 4, y: 10 },
      )
      expect(store.state.waste).toEqual([createCard('hearts', 5, true)])

      const unrelatedCard = wrapper.get('[data-testid="card-clubs-8"]')
      await unrelatedCard.trigger('click')

      expect(unrelatedCard.attributes('aria-pressed')).toBe('true')
    })
  })
})
