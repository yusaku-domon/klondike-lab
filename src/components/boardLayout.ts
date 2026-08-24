import { SUITS, type Suit } from '../domain/cards'
import type { GameState } from '../domain/deal'

// TableauColumn's own internal cascade offset (its `top: index * 1.6rem`).
// This is the one piece of layout math that's safe to hardcode: unlike the
// top-row's pile positions (which move whenever the flexible spacer resizes
// with the viewport), this is a fixed, internal detail of a single component.
export const TABLEAU_STACK_OFFSET_REM = 1.6

export interface SlotPosition {
  x: number
  y: number
}

/**
 * Pixel positions of each pile's slot, measured live from the DOM (relative
 * to the game board's own top-left) rather than assumed from CSS. The
 * top-row layout uses a flexible spacer to push foundations to the right
 * edge, so their on-screen position depends on the viewport width and
 * cannot be computed from fixed rem math alone.
 */
export interface SlotLayout {
  stock: SlotPosition
  waste: SlotPosition
  foundations: Record<Suit, SlotPosition>
  tableau: SlotPosition[]
}

export interface CardPosition {
  x: number
  y: number
  z: number
}

export function computeCardPositions(
  state: GameState,
  slots: SlotLayout,
  stackOffsetPx: number,
): Map<string, CardPosition> {
  const positions = new Map<string, CardPosition>()

  state.stock.forEach((card, index) => {
    positions.set(card.id, { x: slots.stock.x, y: slots.stock.y, z: index })
  })

  state.waste.forEach((card, index) => {
    positions.set(card.id, { x: slots.waste.x, y: slots.waste.y, z: index })
  })

  SUITS.forEach((suit) => {
    const slot = slots.foundations[suit]
    state.foundations[suit].forEach((card, index) => {
      positions.set(card.id, { x: slot.x, y: slot.y, z: index })
    })
  })

  state.tableau.forEach((column, columnIndex) => {
    const slot = slots.tableau[columnIndex]
    if (!slot) return
    column.forEach((card, index) => {
      positions.set(card.id, { x: slot.x, y: slot.y + index * stackOffsetPx, z: index })
    })
  })

  return positions
}

function buildLocationMap(state: GameState): Map<string, string> {
  const map = new Map<string, string>()
  state.stock.forEach((card, index) => map.set(card.id, `stock:${index}`))
  state.waste.forEach((card, index) => map.set(card.id, `waste:${index}`))
  state.tableau.forEach((column, columnIndex) => {
    column.forEach((card, index) => map.set(card.id, `tableau:${columnIndex}:${index}`))
  })
  SUITS.forEach((suit) => {
    state.foundations[suit].forEach((card, index) => map.set(card.id, `foundation:${suit}:${index}`))
  })
  return map
}

/**
 * Card IDs whose pile (and/or position within that pile) differs between
 * the two states — i.e. the cards a move/draw/undo/auto-complete actually
 * relocated, as opposed to ones that merely got auto-flipped face up in
 * place. Pure and state-only: doesn't know or care what kind of action
 * caused the change, so it never touches domain/store logic.
 */
export function computeMovedCardIds(previous: GameState, next: GameState): Set<string> {
  const previousLocations = buildLocationMap(previous)
  const nextLocations = buildLocationMap(next)
  const moved = new Set<string>()

  for (const [id, location] of nextLocations) {
    if (previousLocations.get(id) !== location) moved.add(id)
  }

  return moved
}
