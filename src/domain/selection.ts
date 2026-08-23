import type { Suit } from './cards'
import type { GameState } from './deal'
import type { MoveCommand, PileRef } from './moves'

export type ClickTarget =
  | { type: 'stock' }
  | { type: 'waste' }
  | { type: 'foundation'; suit: Suit }
  | { type: 'tableau'; column: number; cardIndex: number | null }

export function isSelectable(state: GameState, target: ClickTarget): boolean {
  switch (target.type) {
    case 'stock':
      return false
    case 'waste':
      return state.waste.length > 0
    case 'foundation':
      return state.foundations[target.suit].length > 0
    case 'tableau': {
      if (target.cardIndex === null) return false
      const card = state.tableau[target.column]?.[target.cardIndex]
      return card?.faceUp === true
    }
  }
}

function toPileRef(target: ClickTarget): PileRef {
  if (target.type === 'tableau') {
    return { type: 'tableau', column: target.column, cardIndex: target.cardIndex ?? undefined }
  }
  return target
}

function isSamePileTarget(selection: PileRef, target: ClickTarget): boolean {
  if (selection.type !== target.type) return false
  if (selection.type === 'tableau' && target.type === 'tableau') {
    return selection.column === target.column && (selection.cardIndex ?? null) === target.cardIndex
  }
  if (selection.type === 'foundation' && target.type === 'foundation') {
    return selection.suit === target.suit
  }
  return true
}

/**
 * Interprets a single click per spec section 3.5's two-step "select, then
 * destination" flow. `attemptMove` is called (and its result trusted) only
 * when `target` is a legal destination shape (tableau/foundation); a return
 * of `true` means the move was applied and the selection should clear.
 */
export function resolveClick(
  state: GameState,
  selection: PileRef | null,
  target: ClickTarget,
  attemptMove: (command: MoveCommand) => boolean,
): PileRef | null {
  if (target.type === 'stock') return selection

  if (selection) {
    const isDestinationType = target.type === 'tableau' || target.type === 'foundation'

    if (isDestinationType) {
      const to: MoveCommand['to'] =
        target.type === 'tableau'
          ? { type: 'tableau', column: target.column }
          : { type: 'foundation', suit: target.suit }
      if (attemptMove({ from: selection, to })) return null
    }

    if (isSamePileTarget(selection, target)) return null
    if (isSelectable(state, target)) return toPileRef(target)
    return isDestinationType ? selection : null
  }

  return isSelectable(state, target) ? toPileRef(target) : null
}
