import { describe, expect, it, vi } from 'vitest'
import { emptyState } from '../testFixtures'
import { createCard } from './cards'
import { applyMove, type MoveCommand } from './moves'
import { isSelectable, resolveClick, type ClickTarget } from './selection'

describe('isSelectable', () => {
  it('is never selectable for stock', () => {
    expect(isSelectable(emptyState(), { type: 'stock' })).toBe(false)
  })

  it('is selectable for a non-empty waste, not for an empty one', () => {
    expect(isSelectable(emptyState(), { type: 'waste' })).toBe(false)
    expect(isSelectable(emptyState({ waste: [createCard('hearts', 1, true)] }), { type: 'waste' })).toBe(
      true,
    )
  })

  it('is selectable for a non-empty foundation, not for an empty one', () => {
    expect(isSelectable(emptyState(), { type: 'foundation', suit: 'hearts' })).toBe(false)
    const state = emptyState({
      foundations: { clubs: [], diamonds: [], hearts: [createCard('hearts', 1, true)], spades: [] },
    })
    expect(isSelectable(state, { type: 'foundation', suit: 'hearts' })).toBe(true)
  })

  it('is selectable only for a face-up tableau card at a real index', () => {
    const state = emptyState({
      tableau: [[createCard('clubs', 5, false), createCard('clubs', 6, true)], [], [], [], [], [], []],
    })
    expect(isSelectable(state, { type: 'tableau', column: 0, cardIndex: null })).toBe(false)
    expect(isSelectable(state, { type: 'tableau', column: 0, cardIndex: 0 })).toBe(false)
    expect(isSelectable(state, { type: 'tableau', column: 0, cardIndex: 1 })).toBe(true)
    expect(isSelectable(state, { type: 'tableau', column: 0, cardIndex: 5 })).toBe(false)
  })
})

describe('resolveClick', () => {
  it('never touches selection or attemptMove when clicking stock', () => {
    const attemptMove = vi.fn(() => true)
    const state = emptyState({ waste: [createCard('hearts', 1, true)] })
    const selection = { type: 'waste' as const }

    expect(resolveClick(state, selection, { type: 'stock' }, attemptMove)).toBe(selection)
    expect(resolveClick(state, null, { type: 'stock' }, attemptMove)).toBeNull()
    expect(attemptMove).not.toHaveBeenCalled()
  })

  it('selects a clicked selectable pile when nothing is selected', () => {
    const state = emptyState({ waste: [createCard('hearts', 1, true)] })
    const attemptMove = vi.fn(() => false)

    const result = resolveClick(state, null, { type: 'waste' }, attemptMove)

    expect(result).toEqual({ type: 'waste' })
    expect(attemptMove).not.toHaveBeenCalled()
  })

  it('stays deselected when clicking a non-selectable pile with nothing selected', () => {
    const state = emptyState()
    const attemptMove = vi.fn(() => false)

    expect(resolveClick(state, null, { type: 'waste' }, attemptMove)).toBeNull()
    expect(resolveClick(state, null, { type: 'tableau', column: 0, cardIndex: null }, attemptMove)).toBeNull()
  })

  it('clears the selection when the same tableau card is clicked again', () => {
    const state = emptyState({
      tableau: [[createCard('clubs', 6, true)], [], [], [], [], [], []],
    })
    const selection = { type: 'tableau' as const, column: 0, cardIndex: 0 }
    const attemptMove = vi.fn(() => false)

    const target: ClickTarget = { type: 'tableau', column: 0, cardIndex: 0 }
    expect(resolveClick(state, selection, target, attemptMove)).toBeNull()
    expect(attemptMove).toHaveBeenCalledWith({ from: selection, to: { type: 'tableau', column: 0 } })
  })

  it('clears the selection on a successful move to a destination', () => {
    const state = emptyState()
    const selection = { type: 'waste' as const }
    const attemptMove = vi.fn(() => true)

    const target: ClickTarget = { type: 'tableau', column: 3, cardIndex: null }
    const result = resolveClick(state, selection, target, attemptMove)

    expect(result).toBeNull()
    expect(attemptMove).toHaveBeenCalledWith({ from: selection, to: { type: 'tableau', column: 3 } })
  })

  it('switches selection to another selectable pile when the move to it fails', () => {
    const state = emptyState({ waste: [createCard('hearts', 1, true)] })
    const selection = { type: 'foundation' as const, suit: 'spades' as const }
    const attemptMove = vi.fn(() => false)

    const result = resolveClick(state, selection, { type: 'waste' }, attemptMove)

    expect(result).toEqual({ type: 'waste' })
  })

  it('keeps the current selection when the destination move fails and the target is not selectable', () => {
    const state = emptyState({
      tableau: [[createCard('clubs', 6, true)], [], [], [], [], [], []],
    })
    const selection = { type: 'foundation' as const, suit: 'spades' as const }
    const attemptMove = vi.fn(() => false)

    const target: ClickTarget = { type: 'tableau', column: 1, cardIndex: null }
    const result = resolveClick(state, selection, target, attemptMove)

    expect(result).toBe(selection)
  })

  it('deselects when clicking a non-destination, non-selectable pile (empty waste)', () => {
    const state = emptyState()
    const selection = { type: 'foundation' as const, suit: 'spades' as const }
    const attemptMove = vi.fn(() => false)

    const result = resolveClick(state, selection, { type: 'waste' }, attemptMove)

    expect(result).toBeNull()
    expect(attemptMove).not.toHaveBeenCalled()
  })

  it('integrates with the real applyMove for a legal waste-to-tableau move', () => {
    const state = emptyState({ waste: [createCard('spades', 13, true)] })
    const selection = { type: 'waste' as const }
    const attemptMove = (command: MoveCommand) => applyMove(state, command) !== state

    const result = resolveClick(state, selection, { type: 'tableau', column: 0, cardIndex: null }, attemptMove)

    expect(result).toBeNull()
  })

  it('integrates with the real applyMove: an illegal move keeps the selection', () => {
    const state = emptyState({ waste: [createCard('hearts', 5, true)] })
    const selection = { type: 'waste' as const }
    const attemptMove = (command: MoveCommand) => applyMove(state, command) !== state

    const result = resolveClick(state, selection, { type: 'tableau', column: 0, cardIndex: null }, attemptMove)

    expect(result).toBe(selection)
  })
})
