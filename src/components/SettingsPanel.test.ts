// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsPanel from './SettingsPanel.vue'

let activeWrapper: ReturnType<typeof mount> | null = null

function mountPanel() {
  const pinia = createPinia()
  setActivePinia(pinia)
  activeWrapper = mount(SettingsPanel, { global: { plugins: [pinia] }, attachTo: document.body })
  return activeWrapper
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  // Unmounting (rather than just wiping the DOM) runs onBeforeUnmount, which
  // removes this component's document-level click listener — otherwise it
  // outlives the test and can swallow clicks meant for the next test's
  // freshly-mounted instance.
  activeWrapper?.unmount()
  activeWrapper = null
  document.body.innerHTML = ''
})

describe('SettingsPanel', () => {
  it('opens the panel when the Settings button is clicked', async () => {
    const wrapper = mountPanel()
    expect(wrapper.find('.panel').exists()).toBe(false)

    await wrapper.get('button').trigger('click')

    expect(wrapper.find('.panel').exists()).toBe(true)
  })

  it('closes the panel when clicking somewhere outside it', async () => {
    const wrapper = mountPanel()
    await wrapper.get('button').trigger('click')
    expect(wrapper.find('.panel').exists()).toBe(true)

    const outsideButton = document.createElement('button')
    document.body.appendChild(outsideButton)
    outsideButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.panel').exists()).toBe(false)
  })

  it('swallows the outside click instead of also triggering it', async () => {
    const wrapper = mountPanel()
    await wrapper.get('button').trigger('click')

    const outsideButton = document.createElement('button')
    const outsideHandler = vi.fn()
    outsideButton.addEventListener('click', outsideHandler)
    document.body.appendChild(outsideButton)
    outsideButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await wrapper.vm.$nextTick()

    expect(outsideHandler).not.toHaveBeenCalled()
  })

  it('does not close the panel when clicking inside it', async () => {
    const wrapper = mountPanel()
    await wrapper.get('button').trigger('click')

    await wrapper.get('.setting-row input[type="checkbox"]').trigger('click')

    expect(wrapper.find('.panel').exists()).toBe(true)
  })

  it('still toggles closed when clicking the Settings button itself while open', async () => {
    const wrapper = mountPanel()
    const toggleButton = wrapper.get('button')
    await toggleButton.trigger('click')
    expect(wrapper.find('.panel').exists()).toBe(true)

    await toggleButton.trigger('click')

    expect(wrapper.find('.panel').exists()).toBe(false)
  })
})
