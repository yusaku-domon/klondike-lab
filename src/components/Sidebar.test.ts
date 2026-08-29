// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import Sidebar from './Sidebar.vue'

function mountSidebar() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(Sidebar, { global: { plugins: [pinia] } })
}

beforeEach(() => {
  localStorage.clear()
})

describe('Sidebar', () => {
  it('starts with the icon row hidden, showing only the toggle button', () => {
    const wrapper = mountSidebar()

    expect(wrapper.find('[aria-label="Settings"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Seed"]').exists()).toBe(false)
  })

  it('reveals the Settings and Seed icons when toggled open', async () => {
    const wrapper = mountSidebar()

    await wrapper.get('[aria-label="Toggle sidebar"]').trigger('click')

    expect(wrapper.find('[aria-label="Settings"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Seed"]').exists()).toBe(true)
  })

  it('hides the icons again on a second toggle', async () => {
    const wrapper = mountSidebar()
    const toggle = wrapper.get('[aria-label="Toggle sidebar"]')
    await toggle.trigger('click')

    await toggle.trigger('click')

    expect(wrapper.find('[aria-label="Settings"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Seed"]').exists()).toBe(false)
  })

  it('opens the Settings modal when its icon is clicked', async () => {
    const wrapper = mountSidebar()
    await wrapper.get('[aria-label="Toggle sidebar"]').trigger('click')

    await wrapper.get('[aria-label="Settings"]').trigger('click')

    expect(wrapper.find('[aria-label="Settings"][aria-modal="true"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Seed"][aria-modal="true"]').exists()).toBe(false)
  })

  it('opens the Seed modal when its icon is clicked', async () => {
    const wrapper = mountSidebar()
    await wrapper.get('[aria-label="Toggle sidebar"]').trigger('click')

    await wrapper.get('[aria-label="Seed"]').trigger('click')

    expect(wrapper.find('[aria-label="Seed"][aria-modal="true"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Settings"][aria-modal="true"]').exists()).toBe(false)
  })

  it('closes the open modal when its close button is clicked', async () => {
    const wrapper = mountSidebar()
    await wrapper.get('[aria-label="Toggle sidebar"]').trigger('click')
    await wrapper.get('[aria-label="Settings"]').trigger('click')

    await wrapper.get('[aria-label="Close"]').trigger('click')

    expect(wrapper.find('[aria-modal="true"]').exists()).toBe(false)
  })
})
