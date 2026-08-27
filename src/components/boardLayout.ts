import { SUITS, type Suit } from '../domain/cards'
import type { GameState } from '../domain/deal'
import type { MoveCommand } from '../domain/moves'

// TableauColumn's own internal cascade offset, as a fraction of
// --card-height rather than a fixed rem — imported by TableauColumn itself
// for its `top` styling, and by GameBoard for the matching
// CardAnimationLayer position math below, so the two can never drift
// apart. A fraction (not an absolute length) so the cascade stays the same
// proportion of the card at any --card-height the responsive clamp() in
// style.css produces, not just the desktop default.
export const TABLEAU_STACK_OFFSET_RATIO = 1.6 / 6.5

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

/**
 * Move-navigation hint strength, shared by every component that renders a
 * highlight (GameBoard, TableauColumn, FoundationPile, CardAnimationLayer)
 * so they can't drift out of sync with each other.
 */
export type HighlightLevel = 'none' | 'weak' | 'strong'

/** A destination always has one of these two — 'none' only applies to a
 * pile that isn't a legal destination, which never gets an entry at all. */
export type DestinationHighlightLevel = Exclude<HighlightLevel, 'none'>

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

// Smaller than a real drag needs to feel deliberate, larger than the jitter
// a finger or mouse produces holding still — below this, a pointerdown+up
// is treated as a plain tap (the existing click-based selection handles
// it), not a drag.
export const DRAG_THRESHOLD_PX = 8

export function exceedsDragThreshold(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX
}

function isWithinSlot(
  point: SlotPosition,
  slot: SlotPosition,
  width: number,
  height: number,
): boolean {
  return (
    point.x >= slot.x && point.x <= slot.x + width && point.y >= slot.y && point.y <= slot.y + height
  )
}

/**
 * Which pile (if any) a drag ended over, given a board-relative drop point
 * and the same measured `SlotLayout` the animation layer positions cards
 * with. Foundations are tested as their own compact slot; a tableau column
 * has no fixed bottom edge (it grows as cards land in it), so a drop
 * anywhere in its horizontal lane at or below its slot counts — the player
 * doesn't have to land pixel-precisely on the last stacked card. Waste and
 * stock are never drop targets, matching MoveCommand['to']'s own type.
 */
export function hitTestDropTarget(
  point: SlotPosition,
  slots: SlotLayout,
  cardWidthPx: number,
  cardHeightPx: number,
): MoveCommand['to'] | null {
  for (const suit of SUITS) {
    if (isWithinSlot(point, slots.foundations[suit], cardWidthPx, cardHeightPx)) {
      return { type: 'foundation', suit }
    }
  }

  for (let column = 0; column < slots.tableau.length; column++) {
    const slot = slots.tableau[column]!
    if (point.x >= slot.x && point.x <= slot.x + cardWidthPx && point.y >= slot.y) {
      return { type: 'tableau', column }
    }
  }

  return null
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
