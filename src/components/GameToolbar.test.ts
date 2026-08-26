// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
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
  })
})
