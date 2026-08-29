// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSettingsStore } from '../stores/settings'
import SettingsModal from './SettingsModal.vue'

function mountModal() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const settings = useSettingsStore()
  const wrapper = mount(SettingsModal, { global: { plugins: [pinia] } })
  return { wrapper, settings }
}

beforeEach(() => {
  localStorage.clear()
})

describe('SettingsModal', () => {
  it('emits close when the × button is clicked', async () => {
    const { wrapper } = mountModal()

    await wrapper.get('[aria-label="Close"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('toggles moveNavigationEnabled via the checkbox', async () => {
    const { wrapper, settings } = mountModal()
    expect(settings.moveNavigationEnabled).toBe(true)

    await wrapper.get('.setting-row input[type="checkbox"]').setValue(false)

    expect(settings.moveNavigationEnabled).toBe(false)
  })

  it('changes cardDesign via the select', async () => {
    const { wrapper, settings } = mountModal()

    await wrapper.get('.setting-row select').setValue('saulspatz')

    expect(settings.cardDesign).toBe('saulspatz')
  })
})
