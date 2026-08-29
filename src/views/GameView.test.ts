// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import GameView from './GameView.vue'

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(GameView, { global: { plugins: [pinia] } })
}

beforeEach(() => {
  localStorage.clear()
})

// Regression coverage for a bug where clicking the hamburger button only
// added icon buttons inside the header instead of showing an actual
// sidebar panel — invisible to Sidebar.vue's own isolated unit tests, since
// those never mount it alongside the toolbar/board it's meant to displace.
// The sidebar is a fixed overlay (Sidebar.vue's own CSS handles position/
// z-index/transform), so this only checks the open/close wiring here, not
// layout geometry — that's verified in the browser instead.
describe('GameView sidebar integration', () => {
  it('starts with the sidebar panel closed', () => {
    const wrapper = mountView()

    expect(wrapper.get('#app-sidebar').classes()).not.toContain('sidebar--open')
    expect(wrapper.get('[aria-label="Toggle sidebar"]').attributes('aria-expanded')).toBe('false')
  })

  it('opens the sidebar panel when the hamburger button is clicked', async () => {
    const wrapper = mountView()

    await wrapper.get('[aria-label="Toggle sidebar"]').trigger('click')

    expect(wrapper.get('#app-sidebar').classes()).toContain('sidebar--open')
    expect(wrapper.get('[aria-label="Toggle sidebar"]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('[aria-label="Settings"]').exists()).toBe(true)
  })

  it('closes again on a second click of the hamburger button', async () => {
    const wrapper = mountView()
    await wrapper.get('[aria-label="Toggle sidebar"]').trigger('click')

    await wrapper.get('[aria-label="Toggle sidebar"]').trigger('click')

    expect(wrapper.get('#app-sidebar').classes()).not.toContain('sidebar--open')
  })

  it('closes on Escape while open', async () => {
    const wrapper = mountView()
    await wrapper.get('[aria-label="Toggle sidebar"]').trigger('click')

    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.get('#app-sidebar').classes()).not.toContain('sidebar--open')
  })
})
