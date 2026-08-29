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

// Matches whichever of the two toggle buttons (header "open" button,
// Sidebar.vue's in-panel "close" button) is currently rendered — the two
// share this attribute, but per spec are never both present at once, so
// this always resolves to at most one real element.
function toggleControl(wrapper: ReturnType<typeof mount>) {
  return wrapper.get('[aria-controls="app-sidebar"]')
}

function aside(wrapper: ReturnType<typeof mount>) {
  return wrapper.get('#app-sidebar')
}

async function endClosingTransition(wrapper: ReturnType<typeof mount>) {
  // Sidebar.vue only treats this as "actually closed" once its own
  // transitionend fires with propertyName: 'transform' while already
  // closed — mirrors what the real 0.25s CSS transition does, without
  // waiting on it in a unit test.
  await aside(wrapper).trigger('transitionend', { propertyName: 'transform' })
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
  it('starts with only the header open-button shown', () => {
    const wrapper = mountView()

    expect(aside(wrapper).classes()).not.toContain('sidebar--open')
    expect(wrapper.findAll('[aria-controls="app-sidebar"]')).toHaveLength(1)
    expect(toggleControl(wrapper).attributes('aria-label')).toBe('サイドバーを開く')
    expect(toggleControl(wrapper).attributes('aria-expanded')).toBe('false')
  })

  it('hides the header button and shows the in-panel close button the instant it opens — before the slide even finishes', async () => {
    const wrapper = mountView()

    await toggleControl(wrapper).trigger('click')

    expect(aside(wrapper).classes()).toContain('sidebar--open')
    expect(wrapper.findAll('[aria-controls="app-sidebar"]')).toHaveLength(1)
    const control = toggleControl(wrapper)
    expect(control.attributes('aria-label')).toBe('サイドバーを閉じる')
    expect(control.attributes('aria-expanded')).toBe('true')
    // The close button must be a real descendant of the sliding <aside>
    // itself, not a sibling positioned to merely look aligned with it.
    expect(aside(wrapper).find('[aria-controls="app-sidebar"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Settings"]').exists()).toBe(true)
  })

  it('does not bring the header button back until the closing transition actually ends', async () => {
    const wrapper = mountView()
    await toggleControl(wrapper).trigger('click')

    await toggleControl(wrapper).trigger('click') // clicks the in-panel close button

    // Still mid-slide-out: sidebarOpen is false, but neither button should
    // be considered "the" reappeared header button yet — the sidebar's own
    // close button unmounts immediately (v-if="open"), but the header
    // button must wait for the transitionend signal.
    expect(aside(wrapper).classes()).not.toContain('sidebar--open')
    expect(wrapper.find('[aria-controls="app-sidebar"]').exists()).toBe(false)

    await endClosingTransition(wrapper)

    expect(wrapper.findAll('[aria-controls="app-sidebar"]')).toHaveLength(1)
    expect(toggleControl(wrapper).attributes('aria-label')).toBe('サイドバーを開く')
  })

  it('does not reappear from the opening transition ending, only the closing one', async () => {
    const wrapper = mountView()
    await toggleControl(wrapper).trigger('click')

    // The panel's own opening slide finishes; sidebarOpen is still true.
    await endClosingTransition(wrapper)

    expect(toggleControl(wrapper).attributes('aria-label')).toBe('サイドバーを閉じる')
  })

  it('closes on Escape, then restores the header button once its transition ends', async () => {
    const wrapper = mountView()
    await toggleControl(wrapper).trigger('click')

    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(aside(wrapper).classes()).not.toContain('sidebar--open')
    expect(wrapper.find('[aria-controls="app-sidebar"]').exists()).toBe(false)

    await endClosingTransition(wrapper)

    expect(toggleControl(wrapper).attributes('aria-label')).toBe('サイドバーを開く')
  })

  it('survives repeated open/close cycles without ever showing two controls at once', async () => {
    const wrapper = mountView()

    for (let i = 0; i < 5; i++) {
      await toggleControl(wrapper).trigger('click') // open
      expect(wrapper.findAll('[aria-controls="app-sidebar"]').length).toBeLessThanOrEqual(1)

      await toggleControl(wrapper).trigger('click') // close (in-panel button)
      expect(wrapper.findAll('[aria-controls="app-sidebar"]').length).toBeLessThanOrEqual(1)

      await endClosingTransition(wrapper) // header button reappears
      expect(wrapper.findAll('[aria-controls="app-sidebar"]')).toHaveLength(1)
    }
  })

  it('swaps the chevron/lines order to match which button is showing, never both arrangements at once', async () => {
    const wrapper = mountView()

    expect(toggleControl(wrapper).find('.toggle-icon').classes()).not.toContain('toggle-icon--open')
    expect(wrapper.findAll('.toggle-icon')).toHaveLength(1)

    await toggleControl(wrapper).trigger('click')

    expect(toggleControl(wrapper).find('.toggle-icon').classes()).toContain('toggle-icon--open')
    expect(wrapper.findAll('.toggle-icon')).toHaveLength(1)
  })
})
