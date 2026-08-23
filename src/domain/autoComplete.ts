import type { GameState } from './deal'
import { applyMove, type MoveCommand } from './moves'
import { canPlaceOnFoundation } from './rules'

/**
 * True once no hidden information remains: the stock is empty and every
 * tableau card is face up. Independent of `status` so callers (e.g. a UI
 * prompt) can tell "the board just got fully revealed" apart from
 * "the game is currently pausable/playable".
 */
export function isFullyRevealed(state: GameState): boolean {
  return (
    state.stock.length === 0 &&
    state.tableau.every((column) => column.every((card) => card.faceUp))
  )
}

/**
 * Auto-complete is only offered once the board is fully revealed AND the
 * game is actually playing. This is a mechanical shortcut for moves the
 * player could already see and make themselves — not a solver — so it
 * deliberately does not search or backtrack.
 */
export function canAutoComplete(state: GameState): boolean {
  return state.status === 'playing' && isFullyRevealed(state)
}

function findNextFoundationMove(state: GameState): MoveCommand | null {
  if (state.waste.length > 0) {
    const card = state.waste[state.waste.length - 1]!
    if (canPlaceOnFoundation(state.foundations[card.suit], card)) {
      return { from: { type: 'waste' }, to: { type: 'foundation', suit: card.suit } }
    }
  }

  for (let column = 0; column < state.tableau.length; column++) {
    const pile = state.tableau[column]!
    if (pile.length === 0) continue
    const card = pile[pile.length - 1]!
    if (canPlaceOnFoundation(state.foundations[card.suit], card)) {
      return {
        from: { type: 'tableau', column, cardIndex: pile.length - 1 },
        to: { type: 'foundation', suit: card.suit },
      }
    }
  }

  return null
}

/**
 * Repeatedly sends any waste/tableau top card that is immediately eligible
 * for its foundation, until no such move remains. Since every card is
 * already visible, this never needs to guess or try alternatives — but it
 * also isn't guaranteed to fully clear the board: a poorly-ordered pile can
 * still leave cards stuck behind one another, in which case this simply
 * stops and returns however far it got.
 */
export function autoCompleteAll(state: GameState): GameState {
  let current = state
  for (;;) {
    const command = findNextFoundationMove(current)
    if (!command) return current
    const next = applyMove(current, command)
    if (next === current) return current
    current = next
  }
}
