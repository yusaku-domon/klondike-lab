// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createCard } from '../domain/cards'
import PlayingCard from './PlayingCard.vue'

describe('PlayingCard', () => {
  describe('cardDesign: classic (default)', () => {
    it('renders the corner indices and a single large centered symbol, for every rank', () => {
      const wrapper = mount(PlayingCard, { props: { card: createCard('hearts', 7, true) } })

      expect(wrapper.find('.corner.top').text()).toBe('7♥')
      expect(wrapper.find('.corner.bottom').text()).toBe('7♥')
      expect(wrapper.find('.suit-symbol-large').exists()).toBe(true)
      expect(wrapper.find('img').exists()).toBe(false)
    })

    it('renders nothing inside a face-down card (the CSS back pattern shows instead)', () => {
      const wrapper = mount(PlayingCard, { props: { card: createCard('spades', 5, false) } })

      expect(wrapper.find('.corner').exists()).toBe(false)
      expect(wrapper.find('img').exists()).toBe(false)
      expect(wrapper.classes()).toContain('face-down')
    })
  })

  describe('cardDesign: saulspatz', () => {
    it('renders the front image for a face-up card, with no classic markup', () => {
      const wrapper = mount(PlayingCard, {
        props: { card: createCard('diamonds', 10, true), cardDesign: 'saulspatz' },
      })

      expect(wrapper.find('.corner').exists()).toBe(false)
      expect(wrapper.find('.suit-symbol-large').exists()).toBe(false)
      expect(wrapper.get('img').attributes('src')).toBe('/cards/saulspatz/diamonds-10.svg')
    })

    it('renders the shared back image for a face-down card', () => {
      const wrapper = mount(PlayingCard, {
        props: { card: createCard('clubs', 3, false), cardDesign: 'saulspatz' },
      })

      expect(wrapper.get('img').attributes('src')).toBe('/cards/saulspatz/back.svg')
    })
  })

  describe('accessibility semantics stay consistent across designs', () => {
    it.each(['classic', 'saulspatz'] as const)(
      'reports the same aria-label and data-testid under %s',
      (deck) => {
        const wrapper = mount(PlayingCard, {
          props: {
            card: createCard('hearts', 12, true),
            interactive: true,
            selected: true,
            cardDesign: deck,
          },
        })

        expect(wrapper.attributes('aria-label')).toBe('Q of Hearts, selected')
        expect(wrapper.attributes('data-testid')).toBe('card-hearts-12')
      },
    )
  })
})
