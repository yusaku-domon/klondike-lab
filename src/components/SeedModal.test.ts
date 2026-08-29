// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyState } from '../testFixtures'
import { useGameStore } from '../stores/game'
import SeedModal from './SeedModal.vue'

function mountModal() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGameStore()
  const wrapper = mount(SeedModal, { global: { plugins: [pinia] } })
  return { wrapper, store }
}

beforeEach(() => {
  localStorage.clear()
})

describe('SeedModal', () => {
  it('emits close when the × button is clicked', async () => {
    const { wrapper } = mountModal()

    await wrapper.get('[aria-label="Close"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  describe('start with this seed', () => {
    it('disables the submit button while the seed field is empty', async () => {
      const { wrapper } = mountModal()
      const submit = wrapper.get('.seed-form button[type="submit"]')

      expect(submit.attributes('disabled')).toBeDefined()

      await wrapper.get('.seed-form input').setValue('123')
      expect(submit.attributes('disabled')).toBeUndefined()

      await wrapper.get('.seed-form input').setValue('')
      expect(submit.attributes('disabled')).toBeDefined()
    })

    it('does not start a new game from a blank seed submission, even bypassing the disabled button', async () => {
      const { wrapper, store } = mountModal()
      const original = store.state

      await wrapper.get('.seed-form').trigger('submit')

      expect(store.state).toBe(original)
    })

    it('starts a new game with the entered seed once the field is non-empty', async () => {
      const { wrapper, store } = mountModal()

      await wrapper.get('.seed-form input').setValue('42')
      await wrapper.get('.seed-form').trigger('submit')

      expect(store.state.seed).toBe(42)
    })

    it('asks for confirmation instead of switching immediately when real progress would be lost', async () => {
      const { wrapper, store } = mountModal()
      store.state = emptyState({ moveCount: 3, status: 'playing' })
      await wrapper.vm.$nextTick()

      await wrapper.get('.seed-form input').setValue('42')
      await wrapper.get('.seed-form').trigger('submit')

      expect(store.state.seed).not.toBe(42)
      expect(wrapper.find('.seed-form').exists()).toBe(false)
      expect(wrapper.get('.modal-title').text()).toBe('Start a new game?')
    })

    it('switches to the new seed once the in-modal confirmation is accepted', async () => {
      const { wrapper, store } = mountModal()
      store.state = emptyState({ moveCount: 3, status: 'playing' })
      await wrapper.vm.$nextTick()
      await wrapper.get('.seed-form input').setValue('42')
      await wrapper.get('.seed-form').trigger('submit')

      await wrapper.get('.prompt-actions button:first-child').trigger('click')

      expect(store.state.seed).toBe(42)
    })

    it('keeps the current game and returns to the form when declined', async () => {
      const { wrapper, store } = mountModal()
      store.state = emptyState({ moveCount: 3, status: 'playing' })
      const before = store.state
      await wrapper.vm.$nextTick()
      await wrapper.get('.seed-form input').setValue('42')
      await wrapper.get('.seed-form').trigger('submit')

      await wrapper.get('.prompt-actions button:last-child').trigger('click')

      expect(store.state).toBe(before)
      expect(wrapper.find('.seed-form').exists()).toBe(true)
    })
  })

  describe('history', () => {
    it('shows a placeholder when nothing has been recorded yet', () => {
      const { wrapper } = mountModal()

      expect(wrapper.get('.history-empty').text()).toBe('No finished games yet.')
    })

    it('lists past results newest-first with seed value and Win/Lose', async () => {
      const { wrapper, store } = mountModal()
      store.state = emptyState({ seed: 111, moveCount: 5, status: 'won' })
      store.newGame(222)
      await wrapper.vm.$nextTick()

      const rows = wrapper.findAll('.history-row')
      expect(rows).toHaveLength(1)
      expect(rows[0]!.get('.history-seed').text()).toBe('111')
      expect(rows[0]!.get('.history-result').text()).toBe('Win')
    })

    it('copies the seed value to the clipboard when the copy button is clicked', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })

      const { wrapper, store } = mountModal()
      store.state = emptyState({ seed: 111, moveCount: 5, status: 'playing' })
      store.newGame(222)
      await wrapper.vm.$nextTick()

      await wrapper.get('.history-row .icon-btn').trigger('click')

      expect(writeText).toHaveBeenCalledWith('111')

      vi.unstubAllGlobals()
    })
  })
})
