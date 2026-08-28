// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyState } from '../testFixtures'
import { useGameStore } from '../stores/game'
import GameToolbar from './GameToolbar.vue'

function mountToolbar() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGameStore()
  const wrapper = mount(GameToolbar, { global: { plugins: [pinia] } })
  return { wrapper, store }
}

beforeEach(() => {
  localStorage.clear()
})

describe('GameToolbar', () => {
  describe('start-with-seed form', () => {
    it('disables the submit button while the seed field is empty', async () => {
      const { wrapper } = mountToolbar()
      const submit = wrapper.get('.seed-form button[type="submit"]')

      expect(submit.attributes('disabled')).toBeDefined()

      await wrapper.get('.seed-form input').setValue('123')
      expect(submit.attributes('disabled')).toBeUndefined()

      await wrapper.get('.seed-form input').setValue('')
      expect(submit.attributes('disabled')).toBeDefined()
    })

    it('does not start a new game from a blank seed submission, even bypassing the disabled button', async () => {
      const { wrapper, store } = mountToolbar()
      const original = store.state

      // Simulates a browser that still fires submit on Enter despite the
      // disabled button (defense in depth in startWithSeed itself).
      await wrapper.get('.seed-form').trigger('submit')

      expect(store.state).toBe(original)
    })

    it('starts a new game with the entered seed once the field is non-empty', async () => {
      const { wrapper, store } = mountToolbar()

      await wrapper.get('.seed-form input').setValue('42')
      await wrapper.get('.seed-form').trigger('submit')

      expect(store.state.seed).toBe(42)
    })

    it('asks for confirmation instead of switching immediately when real progress would be lost', async () => {
      const { wrapper, store } = mountToolbar()
      store.state = emptyState({ moveCount: 3, status: 'playing' })
      await wrapper.vm.$nextTick()

      await wrapper.get('.seed-form input').setValue('42')
      await wrapper.get('.seed-form').trigger('submit')

      expect(store.state.seed).not.toBe(42)
      expect(wrapper.find('.discard-confirm').exists()).toBe(true)
    })
  })

  describe('discard confirmation', () => {
    it('starts immediately, with no confirmation, when nothing has been moved yet', async () => {
      const { wrapper, store } = mountToolbar()

      await wrapper.get('.actions .btn').trigger('click')

      expect(wrapper.find('.discard-confirm').exists()).toBe(false)
      expect(store.state.moveCount).toBe(0)
    })

    it('asks for confirmation before discarding an in-progress, unfinished game', async () => {
      const { wrapper, store } = mountToolbar()
      store.state = emptyState({ moveCount: 5, status: 'playing' })
      const before = store.state
      await wrapper.vm.$nextTick()

      await wrapper.get('.actions .btn').trigger('click')

      expect(wrapper.find('.discard-confirm').exists()).toBe(true)
      expect(store.state).toBe(before)
    })

    it('switches to a new game once the confirmation is accepted', async () => {
      const { wrapper, store } = mountToolbar()
      store.state = emptyState({ moveCount: 5, status: 'playing' })
      await wrapper.vm.$nextTick()

      await wrapper.get('.actions .btn').trigger('click')
      await wrapper.get('.discard-confirm .prompt-actions button:first-child').trigger('click')

      expect(wrapper.find('.discard-confirm').exists()).toBe(false)
      expect(store.state.moveCount).toBe(0)
    })

    it('keeps the current game and closes the prompt when the confirmation is declined', async () => {
      const { wrapper, store } = mountToolbar()
      store.state = emptyState({ moveCount: 5, status: 'playing' })
      const before = store.state
      await wrapper.vm.$nextTick()

      await wrapper.get('.actions .btn').trigger('click')
      await wrapper.get('.discard-confirm .prompt-actions button:last-child').trigger('click')

      expect(wrapper.find('.discard-confirm').exists()).toBe(false)
      expect(store.state).toBe(before)
    })

    it('starts immediately, with no confirmation, once the game is already won', async () => {
      const { wrapper, store } = mountToolbar()
      store.state = emptyState({ moveCount: 40, status: 'won' })
      await wrapper.vm.$nextTick()

      await wrapper.get('.actions .btn').trigger('click')

      expect(wrapper.find('.discard-confirm').exists()).toBe(false)
      expect(store.state.moveCount).toBe(0)
    })
  })

  describe('abbreviated/icon action buttons keep their full accessible name', () => {
    it('labels New, Undo, Pause, and Auto with their un-abbreviated aria-label', () => {
      const { wrapper } = mountToolbar()
      const [newGame, undo, pause, auto] = wrapper.findAll('.actions .btn')

      expect(newGame.attributes('aria-label')).toBe('New Game')
      expect(undo.attributes('aria-label')).toBe('Undo')
      expect(pause.attributes('aria-label')).toBe('Pause')
      expect(auto.attributes('aria-label')).toBe('Auto Complete')
    })

    it("relabels Pause's icon button to Resume once the game is paused", async () => {
      const { wrapper, store } = mountToolbar()
      store.pause()
      await wrapper.vm.$nextTick()

      const [, , pause] = wrapper.findAll('.actions .btn')
      expect(pause.attributes('aria-label')).toBe('Resume')
    })

    it('labels the Settings toggle button', () => {
      const { wrapper } = mountToolbar()
      const settingsButton = wrapper.findAll('.actions .btn').at(-1)

      expect(settingsButton?.attributes('aria-label')).toBe('Settings')
    })
  })
})
