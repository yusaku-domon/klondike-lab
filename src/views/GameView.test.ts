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

// The header's own "open" button — always mounted (see GameToolbar.vue's
// own comment), regardless of whether the sidebar is currently open.
function headerToggle(wrapper: ReturnType<typeof mount>) {
  return wrapper.get('.toolbar [aria-controls="app-sidebar"]')
}

// The panel's own in-panel "close" button — a real DOM child of the
// sliding <aside>, only mounted while open.
function panelClose(wrapper: ReturnType<typeof mount>) {
  return wrapper.get('aside#app-sidebar [aria-controls="app-sidebar"]')
}

function aside(wrapper: ReturnType<typeof mount>) {
  return wrapper.get('#app-sidebar')
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
  it('starts closed: only the header button exists, interactive, showing the opening state', () => {
    const wrapper = mountView()

    expect(aside(wrapper).classes()).not.toContain('sidebar--open')
    expect(wrapper.findAll('[aria-controls="app-sidebar"]')).toHaveLength(1)
    const toggle = headerToggle(wrapper)
    expect(toggle.attributes('aria-label')).toBe('サイドバーを開く')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(toggle.attributes('inert')).toBeUndefined()
  })

  it('opening mounts the in-panel close button without removing the header button, and makes it inert', async () => {
    const wrapper = mountView()

    await headerToggle(wrapper).trigger('click')

    expect(aside(wrapper).classes()).toContain('sidebar--open')
    // Both now exist at once — the header button is still mounted, just
    // covered by the (higher z-index) open panel and inert; the panel's
    // own close button is a real descendant of the sliding <aside>, not a
    // sibling merely positioned to look aligned with it.
    expect(wrapper.findAll('[aria-controls="app-sidebar"]')).toHaveLength(2)
    expect(headerToggle(wrapper).attributes('inert')).toBeDefined()
    const close = panelClose(wrapper)
    expect(close.attributes('aria-label')).toBe('サイドバーを閉じる')
    expect(close.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('[aria-label="Settings"]').exists()).toBe(true)
  })

  it('closing (via the in-panel button) unmounts that button and makes the header button interactive again immediately', async () => {
    const wrapper = mountView()
    await headerToggle(wrapper).trigger('click')

    await panelClose(wrapper).trigger('click')

    // No transitionend/animation-completion wait needed — the header
    // button's own interactivity is a direct function of sidebarOpen, not
    // of whether the slide-out has visually finished.
    expect(aside(wrapper).classes()).not.toContain('sidebar--open')
    expect(wrapper.findAll('[aria-controls="app-sidebar"]')).toHaveLength(1)
    expect(headerToggle(wrapper).attributes('inert')).toBeUndefined()
  })

  it('closes on Escape, restoring the header button immediately', async () => {
    const wrapper = mountView()
    await headerToggle(wrapper).trigger('click')

    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(aside(wrapper).classes()).not.toContain('sidebar--open')
    expect(wrapper.findAll('[aria-controls="app-sidebar"]')).toHaveLength(1)
    expect(headerToggle(wrapper).attributes('inert')).toBeUndefined()
  })

  it('survives repeated open/close cycles', async () => {
    const wrapper = mountView()

    for (let i = 0; i < 5; i++) {
      await headerToggle(wrapper).trigger('click') // open
      expect(wrapper.findAll('[aria-controls="app-sidebar"]')).toHaveLength(2)

      await panelClose(wrapper).trigger('click') // close
      expect(wrapper.findAll('[aria-controls="app-sidebar"]')).toHaveLength(1)
    }
  })

  it('keeps each button on its own independent chevron/close-icon branch while both exist', async () => {
    const wrapper = mountView()

    expect(headerToggle(wrapper).find('.toggle-icon').classes()).not.toContain('toggle-icon--open')

    await headerToggle(wrapper).trigger('click')

    // The header button's own icon never changes — it always represents
    // "closed, click to open", independent of the panel's own close icon.
    expect(headerToggle(wrapper).find('.toggle-icon').classes()).not.toContain('toggle-icon--open')
    expect(headerToggle(wrapper).find('.toggle-icon__chevron').exists()).toBe(true)
    expect(panelClose(wrapper).find('.toggle-icon').classes()).toContain('toggle-icon--open')
    expect(panelClose(wrapper).find('.toggle-icon__close').exists()).toBe(true)
  })
})
