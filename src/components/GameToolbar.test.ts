// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyState } from '../testFixtures'
import { useGameStore } from '../stores/game'
import GameToolbar from './GameToolbar.vue'

function mountToolbar(showSidebarToggle = true) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGameStore()
  const wrapper = mount(GameToolbar, {
    props: { showSidebarToggle },
    global: { plugins: [pinia] },
  })
  return { wrapper, store }
}

function newGameButton(wrapper: ReturnType<typeof mount>) {
  return wrapper.get('[aria-label="New Game"]')
}

beforeEach(() => {
  localStorage.clear()
})

describe('GameToolbar', () => {
  describe('discard confirmation', () => {
    it('starts immediately, with no confirmation, when nothing has been moved yet', async () => {
      const { wrapper, store } = mountToolbar()

      await newGameButton(wrapper).trigger('click')

      expect(wrapper.find('.discard-confirm').exists()).toBe(false)
      expect(store.state.moveCount).toBe(0)
    })

    it('asks for confirmation before discarding an in-progress, unfinished game', async () => {
      const { wrapper, store } = mountToolbar()
      store.state = emptyState({ moveCount: 5, status: 'playing' })
      const before = store.state
      await wrapper.vm.$nextTick()

      await newGameButton(wrapper).trigger('click')

      expect(wrapper.find('.discard-confirm').exists()).toBe(true)
      expect(store.state).toBe(before)
    })

    it('switches to a new game once the confirmation is accepted', async () => {
      const { wrapper, store } = mountToolbar()
      store.state = emptyState({ moveCount: 5, status: 'playing' })
      await wrapper.vm.$nextTick()

      await newGameButton(wrapper).trigger('click')
      await wrapper.get('.discard-confirm .prompt-actions button:first-child').trigger('click')

      expect(wrapper.find('.discard-confirm').exists()).toBe(false)
      expect(store.state.moveCount).toBe(0)
    })

    it('keeps the current game and closes the prompt when the confirmation is declined', async () => {
      const { wrapper, store } = mountToolbar()
      store.state = emptyState({ moveCount: 5, status: 'playing' })
      const before = store.state
      await wrapper.vm.$nextTick()

      await newGameButton(wrapper).trigger('click')
      await wrapper.get('.discard-confirm .prompt-actions button:last-child').trigger('click')

      expect(wrapper.find('.discard-confirm').exists()).toBe(false)
      expect(store.state).toBe(before)
    })

    it('starts immediately, with no confirmation, once the game is already won', async () => {
      const { wrapper, store } = mountToolbar()
      store.state = emptyState({ moveCount: 40, status: 'won' })
      await wrapper.vm.$nextTick()

      await newGameButton(wrapper).trigger('click')

      expect(wrapper.find('.discard-confirm').exists()).toBe(false)
      expect(store.state.moveCount).toBe(0)
    })
  })

  describe('header sidebar-open button', () => {
    function toggleButton(wrapper: ReturnType<typeof mount>) {
      return wrapper.get('[aria-controls="app-sidebar"]')
    }

    it('always represents the closed state: aria-expanded false, opening label, chevron before the lines', () => {
      const { wrapper } = mountToolbar(true)
      const toggle = toggleButton(wrapper)

      expect(toggle.attributes('aria-expanded')).toBe('false')
      expect(toggle.attributes('aria-label')).toBe('サイドバーを開く')
      expect(toggle.attributes('aria-controls')).toBe('app-sidebar')
      expect(toggle.find('.toggle-icon').classes()).not.toContain('toggle-icon--open')
    })

    it('is not rendered at all while showSidebarToggle is false', () => {
      const { wrapper } = mountToolbar(false)

      expect(wrapper.find('[aria-controls="app-sidebar"]').exists()).toBe(false)
    })

    it('emits open-sidebar when clicked', async () => {
      const { wrapper } = mountToolbar(true)

      await toggleButton(wrapper).trigger('click')

      expect(wrapper.emitted('open-sidebar')).toHaveLength(1)
    })
  })

  describe('abbreviated/icon action buttons keep their full accessible name', () => {
    it('labels New, Undo, Pause, and Auto with their un-abbreviated aria-label', () => {
      const { wrapper } = mountToolbar()

      expect(() => wrapper.get('[aria-label="New Game"]')).not.toThrow()
      expect(() => wrapper.get('[aria-label="Undo"]')).not.toThrow()
      expect(() => wrapper.get('[aria-label="Pause"]')).not.toThrow()
      expect(() => wrapper.get('[aria-label="Auto Complete"]')).not.toThrow()
    })

    it("relabels Pause's icon button to Resume once the game is paused", async () => {
      const { wrapper, store } = mountToolbar()
      store.pause()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[aria-label="Pause"]').exists()).toBe(false)
      expect(() => wrapper.get('[aria-label="Resume"]')).not.toThrow()
    })
  })
})
