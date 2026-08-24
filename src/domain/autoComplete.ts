import type { GameState } from './deal'
import { applyMove, clickStock, type MoveCommand } from './moves'
import { canPlaceOnFoundation } from './rules'

/**
 * True once every tableau card is face up — deliberately independent of
 * the stock/waste, which may still hold cards (auto-complete cycles
 * through them via clickStock just like a player would). Independent of
 * `status` too, so callers (e.g. a UI prompt) can tell "the board just got
 * fully revealed" apart from "the game is currently pausable/playable".
 */
export function isFullyRevealed(state: GameState): boolean {
  return state.tableau.every((column) => column.every((card) => card.faceUp))
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
 * for its foundation. Since every tableau card is already face up, this
 * never needs to guess or try alternatives about tableau order — but the
 * stock/waste can still be hiding a needed card beneath its current top
 * (or behind other undrawn stock cards). clickStock (draw, or recycle-then-
 * redraw once the stock runs out) is the only way to bring each of those
 * cards to the top in turn, so this interleaves that cycling with
 * foundation checks until either progress dries up for a full lap through
 * the combined stock+waste pile (genuinely stuck — a poorly-ordered pile
 * can still block itself) or nothing is left to draw.
 *
 * Returns every intermediate state along the way (one entry per atomic
 * foundation move or stock click), not just the final result, so a caller
 * can play them back one at a time — e.g. to animate each card's move
 * individually instead of jumping straight to the end state. Purely a
 * state-transition sequence: doesn't know or care whether/how a caller
 * paces or displays it.
 */
export function autoCompleteSteps(state: GameState): GameState[] {
  const steps: GameState[] = []
  let current = state
  let drawsSinceProgress = 0

  for (;;) {
    const command = findNextFoundationMove(current)
    if (command) {
      const next = applyMove(current, command)
      if (next !== current) {
        current = next
        steps.push(current)
        drawsSinceProgress = 0
        continue
      }
    }

    const cycleLength = current.stock.length + current.waste.length
    if (cycleLength === 0 || drawsSinceProgress > cycleLength) {
      return steps
    }

    const drawn = clickStock(current)
    if (drawn === current) return steps
    current = drawn
    steps.push(current)
    drawsSinceProgress += 1
  }
}

/** The final state after every step in `autoCompleteSteps` — for callers
 * that only want the end result and don't need the intermediate states. */
export function autoCompleteAll(state: GameState): GameState {
  const steps = autoCompleteSteps(state)
  return steps.length > 0 ? steps[steps.length - 1]! : state
}
