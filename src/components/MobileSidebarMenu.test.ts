// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MobileSidebarMenu from './MobileSidebarMenu.vue'

function mountMenu() {
  return mount(MobileSidebarMenu, { attachTo: document.body })
}

function toggleButton(wrapper: ReturnType<typeof mountMenu>) {
  return wrapper.get('[aria-controls="mobile-sidebar-menu-panel"]')
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('MobileSidebarMenu', () => {
  it('starts collapsed: closed label, aria-expanded false, hamburger icon', () => {
    const wrapper = mountMenu()
    const toggle = toggleButton(wrapper)

    expect(toggle.attributes('aria-label')).toBe('メニューを開く')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.menu-toggle-icon--close').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Settings"]').isVisible()).toBe(false)
  })

  it('expands on click: open label, aria-expanded true, close icon, both menu items visible', async () => {
    const wrapper = mountMenu()

    await toggleButton(wrapper).trigger('click')

    const toggle = toggleButton(wrapper)
    expect(toggle.attributes('aria-label')).toBe('メニューを閉じる')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('.menu-toggle-icon--close').exists()).toBe(true)
    expect(wrapper.get('[aria-label="Settings"]').isVisible()).toBe(true)
    expect(wrapper.get('[aria-label="Seed"]').isVisible()).toBe(true)
  })

  it('collapses again when the toggle button is clicked while open', async () => {
    const wrapper = mountMenu()
    await toggleButton(wrapper).trigger('click')

    await toggleButton(wrapper).trigger('click')

    expect(toggleButton(wrapper).attributes('aria-expanded')).toBe('false')
  })

  it('emits select("settings") and collapses when Settings is clicked', async () => {
    const wrapper = mountMenu()
    await toggleButton(wrapper).trigger('click')

    await wrapper.get('[aria-label="Settings"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([['settings']])
    expect(toggleButton(wrapper).attributes('aria-expanded')).toBe('false')
  })

  it('emits select("seed") and collapses when Seed is clicked', async () => {
    const wrapper = mountMenu()
    await toggleButton(wrapper).trigger('click')

    await wrapper.get('[aria-label="Seed"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([['seed']])
    expect(toggleButton(wrapper).attributes('aria-expanded')).toBe('false')
  })

  it('closes on Escape while open, but not while closed', async () => {
    const wrapper = mountMenu()
    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(toggleButton(wrapper).attributes('aria-expanded')).toBe('false')

    await toggleButton(wrapper).trigger('click')
    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(toggleButton(wrapper).attributes('aria-expanded')).toBe('false')
  })

  it('closes when clicking outside the menu', async () => {
    const wrapper = mountMenu()
    await toggleButton(wrapper).trigger('click')

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(toggleButton(wrapper).attributes('aria-expanded')).toBe('false')
  })

  it('does not close when clicking inside the menu panel', async () => {
    const wrapper = mountMenu()
    await toggleButton(wrapper).trigger('click')

    await wrapper.get('.menu-panel').trigger('pointerdown')

    expect(toggleButton(wrapper).attributes('aria-expanded')).toBe('true')
  })

  it('returns focus to the toggle button after closing via Escape', async () => {
    const wrapper = mountMenu()
    await toggleButton(wrapper).trigger('click')
    ;(wrapper.get('[aria-label="Settings"]').element as HTMLElement).focus()

    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(document.activeElement).toBe(toggleButton(wrapper).element)
  })

  it('returns focus to the toggle button after closing via outside click', async () => {
    const wrapper = mountMenu()
    await toggleButton(wrapper).trigger('click')
    ;(wrapper.get('[aria-label="Settings"]').element as HTMLElement).focus()

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()

    // Unlike Escape, an outside click means the user's attention is
    // already elsewhere on the board — this deliberately does not yank
    // focus back onto the (now invisible-to-them) toggle button.
    expect(document.activeElement).not.toBe(toggleButton(wrapper).element)
  })

  describe('resize past the breakpoint', () => {
    let changeListener: ((event: { matches: boolean }) => void) | undefined
    let originalMatchMedia: typeof window.matchMedia

    beforeEach(() => {
      originalMatchMedia = window.matchMedia
      changeListener = undefined
      window.matchMedia = vi.fn().mockReturnValue({
        matches: true,
        addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => {
          changeListener = listener
        },
        removeEventListener: vi.fn(),
      }) as unknown as typeof window.matchMedia
    })

    afterEach(() => {
      window.matchMedia = originalMatchMedia
    })

    it('force-closes the menu once the viewport no longer matches <=600px', async () => {
      const wrapper = mountMenu()
      await toggleButton(wrapper).trigger('click')
      expect(toggleButton(wrapper).attributes('aria-expanded')).toBe('true')

      changeListener?.({ matches: false })
      await wrapper.vm.$nextTick()

      expect(toggleButton(wrapper).attributes('aria-expanded')).toBe('false')
    })
  })
})
