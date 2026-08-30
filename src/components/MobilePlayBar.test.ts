// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CARD_MOVE_ANIMATION_MS } from '../animationTiming'
import { emptyState } from '../testFixtures'
import { createCard } from '../domain/cards'
import { useGameStore } from '../stores/game'
import MobilePlayBar from './MobilePlayBar.vue'

function mountBar(sidebarOpen = false) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGameStore()
  const wrapper = mount(MobilePlayBar, {
    props: { sidebarOpen },
    global: { plugins: [pinia] },
  })
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

describe('MobilePlayBar', () => {
  it('renders exactly Undo, Pause, and Redo, in that order', () => {
    const { wrapper } = mountBar()
    const labels = wrapper.findAll('.play-bar-btn').map((btn) => btn.attributes('aria-label'))

    expect(labels).toEqual(['Undo', 'Pause', 'Redo'])
  })

  it('relabels Pause to Resume once the game is paused', async () => {
    const { wrapper, store } = mountBar()
    store.pause()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[aria-label="Pause"]').exists()).toBe(false)
    expect(() => wrapper.get('[aria-label="Resume"]')).not.toThrow()
  })

  it('disables Undo/Redo until there is history, mirroring the header buttons', async () => {
    const { wrapper, store } = mountBar()
    store.state = emptyState({ waste: [createCard('spades', 13, true)] })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[aria-label="Undo"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="Redo"]').attributes('disabled')).toBeDefined()

    store.move({ from: { type: 'waste' }, to: { type: 'tableau', column: 0 } })
    vi.advanceTimersByTime(CARD_MOVE_ANIMATION_MS)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[aria-label="Undo"]').attributes('disabled')).toBeUndefined()

    store.undo()
    vi.advanceTimersByTime(CARD_MOVE_ANIMATION_MS)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[aria-label="Redo"]').attributes('disabled')).toBeUndefined()
  })

  it('disables Pause once the game is won', async () => {
    const { wrapper, store } = mountBar()
    store.state = emptyState({ status: 'won' })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[aria-label="Pause"]').attributes('disabled')).toBeDefined()
  })

  it('clicking Undo/Redo calls the store actions', async () => {
    const { wrapper, store } = mountBar()
    store.state = emptyState({ waste: [createCard('spades', 13, true)] })
    store.move({ from: { type: 'waste' }, to: { type: 'tableau', column: 0 } })
    const afterMove = store.state
    vi.advanceTimersByTime(CARD_MOVE_ANIMATION_MS)
    await wrapper.vm.$nextTick()

    await wrapper.get('[aria-label="Undo"]').trigger('click')
    expect(store.canUndo).toBe(false)
    vi.advanceTimersByTime(CARD_MOVE_ANIMATION_MS)
    await wrapper.vm.$nextTick()

    await wrapper.get('[aria-label="Redo"]').trigger('click')
    expect(store.state).toEqual(afterMove)
  })

  it('clicking Pause/Resume toggles the game status', async () => {
    const { wrapper, store } = mountBar()

    await wrapper.get('[aria-label="Pause"]').trigger('click')
    expect(store.state.status).toBe('paused')

    await wrapper.vm.$nextTick()
    await wrapper.get('[aria-label="Resume"]').trigger('click')
    expect(store.state.status).toBe('playing')
  })

  it('disables every button while the sidebar is open, regardless of history', async () => {
    const { wrapper, store } = mountBar(true)
    store.state = emptyState({ waste: [createCard('spades', 13, true)] })
    store.move({ from: { type: 'waste' }, to: { type: 'tableau', column: 0 } })
    store.undo()
    // Clears the animation lock so what's left disabling these buttons is
    // provably sidebarOpen alone, not a coincidentally-still-active lock.
    vi.advanceTimersByTime(CARD_MOVE_ANIMATION_MS)
    await wrapper.vm.$nextTick()

    // Both Undo and Redo would otherwise be enabled here (there's genuine
    // history in both directions) — sidebarOpen must still win.
    expect(wrapper.get('[aria-label="Undo"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="Redo"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="Pause"]').attributes('disabled')).toBeDefined()
  })

  it('marks the bar itself as inert while the sidebar is open', () => {
    const { wrapper } = mountBar(true)
    expect(wrapper.get('.mobile-play-bar').classes()).toContain('mobile-play-bar--inert')
  })

  it('does not mark the bar inert when the sidebar is closed', () => {
    const { wrapper } = mountBar(false)
    expect(wrapper.get('.mobile-play-bar').classes()).not.toContain('mobile-play-bar--inert')
  })

  it('rises above the pause overlay while paused, so Resume stays reachable through it', async () => {
    const { wrapper, store } = mountBar()
    expect(wrapper.get('.mobile-play-bar').classes()).not.toContain('mobile-play-bar--paused')

    store.pause()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.mobile-play-bar').classes()).toContain('mobile-play-bar--paused')
  })

  it('drops the elevated tier again once resumed', async () => {
    const { wrapper, store } = mountBar()
    store.pause()
    await wrapper.vm.$nextTick()

    store.resume()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.mobile-play-bar').classes()).not.toContain('mobile-play-bar--paused')
  })
})
