// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import Sidebar from './Sidebar.vue'

function mountSidebar(open = false) {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(Sidebar, { props: { open }, global: { plugins: [pinia] } })
}

beforeEach(() => {
  localStorage.clear()
})

describe('Sidebar', () => {
  it('renders as a closed <aside> when the open prop is false', () => {
    const wrapper = mountSidebar(false)

    const aside = wrapper.get('aside#app-sidebar')
    expect(aside.classes()).not.toContain('sidebar--open')
    expect(wrapper.find('[aria-label="Settings"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Seed"]').exists()).toBe(false)
  })

  it('shows the Settings and Seed menu items when open', async () => {
    const wrapper = mountSidebar(true)

    const aside = wrapper.get('aside#app-sidebar')
    expect(aside.classes()).toContain('sidebar--open')
    expect(wrapper.find('[aria-label="Settings"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Seed"]').exists()).toBe(true)
  })

  it('emits close on Escape while open, but not while closed', async () => {
    const wrapper = mountSidebar(false)
    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.setProps({ open: true })
    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('opens the Settings modal when its menu item is clicked', async () => {
    const wrapper = mountSidebar(true)

    await wrapper.get('[aria-label="Settings"]').trigger('click')

    expect(wrapper.find('[aria-label="Settings"][aria-modal="true"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Seed"][aria-modal="true"]').exists()).toBe(false)
  })

  it('opens the Seed modal when its menu item is clicked', async () => {
    const wrapper = mountSidebar(true)

    await wrapper.get('[aria-label="Seed"]').trigger('click')

    expect(wrapper.find('[aria-label="Seed"][aria-modal="true"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Settings"][aria-modal="true"]').exists()).toBe(false)
  })

  it('closes the open modal when its close button is clicked', async () => {
    const wrapper = mountSidebar(true)
    await wrapper.get('[aria-label="Settings"]').trigger('click')

    await wrapper.get('[aria-label="Close"]').trigger('click')

    expect(wrapper.find('[aria-modal="true"]').exists()).toBe(false)
  })
})
