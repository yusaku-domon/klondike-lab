// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS } from '../animationTiming'
import { emptyState } from '../testFixtures'
import { createCard } from '../domain/cards'
import { useGameStore } from '../stores/game'
import AutoFinishButton from './AutoFinishButton.vue'

function mountButton(sidebarOpen = false) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGameStore()
  const wrapper = mount(AutoFinishButton, {
    props: { sidebarOpen },
    global: { plugins: [pinia] },
  })
  return { wrapper, store }
}

// A board one move away from complete — canAutoComplete becomes true
// without needing a fully-shuffled, fully-revealed 52-card fixture.
function almostCompleteState() {
  return emptyState({
    foundations: { clubs: [createCard('clubs', 4, true)], diamonds: [], hearts: [], spades: [] },
    tableau: [[createCard('clubs', 5, true)], [], [], [], [], [], []],
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('AutoFinishButton', () => {
  it('is not rendered at all while auto-complete is unavailable', () => {
    const { wrapper } = mountButton()

    expect(wrapper.find('[aria-label="Auto Finish"]').exists()).toBe(false)
  })

  it('appears the moment auto-complete becomes available', async () => {
    const { wrapper, store } = mountButton()
    store.state = almostCompleteState()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[aria-label="Auto Finish"]').exists()).toBe(true)
  })

  it('starts the auto-complete cascade when clicked', async () => {
    const { wrapper, store } = mountButton()
    store.state = almostCompleteState()
    await wrapper.vm.$nextTick()

    await wrapper.get('[aria-label="Auto Finish"]').trigger('click')

    expect(store.isAnimating).toBe(true)

    await vi.advanceTimersByTimeAsync(AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
    expect(store.state.foundations.clubs).toEqual([
      createCard('clubs', 4, true),
      createCard('clubs', 5, true),
    ])
  })

  it('disappears once the cascade starts, preventing a duplicate trigger', async () => {
    const { wrapper, store } = mountButton()
    store.state = almostCompleteState()
    await wrapper.vm.$nextTick()

    await wrapper.get('[aria-label="Auto Finish"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[aria-label="Auto Finish"]').exists()).toBe(false)

    await vi.advanceTimersByTimeAsync(AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS)
  })

  it('disables and marks itself inert while the sidebar is open', async () => {
    const { wrapper, store } = mountButton(true)
    store.state = almostCompleteState()
    await wrapper.vm.$nextTick()

    const button = wrapper.get('[aria-label="Auto Finish"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.classes()).toContain('auto-finish-btn--inert')
  })

  it('does not disable itself when the sidebar is closed', async () => {
    const { wrapper, store } = mountButton(false)
    store.state = almostCompleteState()
    await wrapper.vm.$nextTick()

    const button = wrapper.get('[aria-label="Auto Finish"]')
    expect(button.attributes('disabled')).toBeUndefined()
    expect(button.classes()).not.toContain('auto-finish-btn--inert')
  })

  it('disappears while the game is paused, since canAutoComplete requires status "playing"', async () => {
    const { wrapper, store } = mountButton()
    store.state = almostCompleteState()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[aria-label="Auto Finish"]').exists()).toBe(true)

    store.pause()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[aria-label="Auto Finish"]').exists()).toBe(false)
  })
})
