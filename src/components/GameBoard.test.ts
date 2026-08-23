// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
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
})
