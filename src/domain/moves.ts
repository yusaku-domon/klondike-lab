import type { Card, Suit } from './cards'
import type { GameState } from './deal'
import { canPlaceOnFoundation, canPlaceOnTableau, isValidTableauRun } from './rules'
import { applyScoreDelta, hasWon, scoreForMove, RECYCLE_WASTE_PENALTY, TABLEAU_FLIP_BONUS } from './scoring'

export type PileRef =
  | { type: 'stock' }
  | { type: 'waste' }
  | { type: 'tableau'; column: number; cardIndex?: number }
  | { type: 'foundation'; suit: Suit }

export interface MoveCommand {
  from: PileRef
  to: Exclude<PileRef, { type: 'stock' } | { type: 'waste' }>
}

function isSamePile(a: PileRef, b: PileRef): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'tableau' && b.type === 'tableau') return a.column === b.column
  if (a.type === 'foundation' && b.type === 'foundation') return a.suit === b.suit
  return true
}

function flipExposedTopCard(column: readonly Card[]): Card[] {
  if (column.length === 0) return []
  const top = column[column.length - 1]!
  if (top.faceUp) return [...column]
  return [...column.slice(0, -1), { ...top, faceUp: true }]
}

export function drawFromStock(state: GameState): GameState {
  if (state.stock.length === 0) return state

  const stock = [...state.stock]
  const drawn = { ...stock.pop()!, faceUp: true }
  const waste = [...state.waste, drawn]

  return { ...state, stock, waste, moveCount: state.moveCount + 1 }
}

export function recycleWaste(state: GameState): GameState {
  if (state.stock.length > 0 || state.waste.length === 0) return state

  const stock = [...state.waste].reverse().map((card) => ({ ...card, faceUp: false }))
  const score = applyScoreDelta(state.score, RECYCLE_WASTE_PENALTY)

  return { ...state, stock, waste: [], moveCount: state.moveCount + 1, score }
}

export function clickStock(state: GameState): GameState {
  return state.stock.length > 0 ? drawFromStock(state) : recycleWaste(state)
}

/**
 * The cards that would move if `from` were picked as a move's source, with
 * no mutation of `state` — used both by `applyMove` (via `extractMovingCards`
 * below) and by `getLegalDestinations`, so the two never disagree about what
 * "the selected cards" are.
 */
export function getMovingCards(state: GameState, from: PileRef): Card[] | null {
  switch (from.type) {
    case 'stock':
      return null

    case 'waste':
      return state.waste.length === 0 ? null : [state.waste[state.waste.length - 1]!]

    case 'foundation': {
      const pile = state.foundations[from.suit]
      return pile.length === 0 ? null : [pile[pile.length - 1]!]
    }

    case 'tableau': {
      const column = state.tableau[from.column]
      if (!column) return null

      const cardIndex = from.cardIndex ?? -1
      const card = column[cardIndex]
      if (!card || !card.faceUp) return null

      const movingCards = column.slice(cardIndex)
      return isValidTableauRun(movingCards) ? movingCards : null
    }
  }
}

function extractMovingCards(
  state: GameState,
  from: PileRef,
): { movingCards: Card[]; flipped: boolean; stateAfterRemoval: GameState } | null {
  const movingCards = getMovingCards(state, from)
  if (!movingCards) return null

  switch (from.type) {
    case 'stock':
      return null

    case 'waste':
      return {
        movingCards,
        flipped: false,
        stateAfterRemoval: { ...state, waste: state.waste.slice(0, -1) },
      }

    case 'foundation': {
      const pile = state.foundations[from.suit]
      return {
        movingCards,
        flipped: false,
        stateAfterRemoval: {
          ...state,
          foundations: { ...state.foundations, [from.suit]: pile.slice(0, -1) },
        },
      }
    }

    case 'tableau': {
      const column = state.tableau[from.column]!
      const cardIndex = from.cardIndex ?? -1
      const remainder = column.slice(0, cardIndex)
      const remainderTop = remainder[remainder.length - 1]
      const flipped = remainderTop !== undefined && !remainderTop.faceUp

      const tableau = [...state.tableau] as GameState['tableau']
      tableau[from.column] = flipExposedTopCard(remainder)

      return { movingCards, flipped, stateAfterRemoval: { ...state, tableau } }
    }
  }
}

/**
 * All legal destinations for whatever is currently selected at `from`,
 * reusing the exact same `canPlaceOnTableau`/`canPlaceOnFoundation` checks
 * `applyMove` uses, so a pile is never highlighted as reachable unless a
 * real move there would actually succeed. Presentation-only: does not
 * touch state, score, undo, or persistence.
 */
export function getLegalDestinations(state: GameState, from: PileRef): PileRef[] {
  const movingCards = getMovingCards(state, from)
  if (!movingCards) return []

  const destinations: PileRef[] = []

  state.tableau.forEach((column, index) => {
    const to: PileRef = { type: 'tableau', column: index }
    if (isSamePile(from, to)) return
    if (canPlaceOnTableau(column, movingCards)) destinations.push(to)
  })

  if (movingCards.length === 1) {
    const card = movingCards[0]!
    const to: PileRef = { type: 'foundation', suit: card.suit }
    // Mirrors placeMovingCards' own suit === to.suit guard: a foundation
    // pile only ever accepts its own suit, even while empty.
    if (!isSamePile(from, to) && canPlaceOnFoundation(state.foundations[card.suit], card)) {
      destinations.push(to)
    }
  }

  return destinations
}

function placeMovingCards(
  state: GameState,
  to: MoveCommand['to'],
  movingCards: Card[],
): GameState | null {
  if (to.type === 'tableau') {
    const column = state.tableau[to.column]
    if (!column || !canPlaceOnTableau(column, movingCards)) return null

    const tableau = [...state.tableau] as GameState['tableau']
    tableau[to.column] = [...column, ...movingCards]
    return { ...state, tableau }
  }

  if (to.type === 'foundation') {
    if (movingCards.length !== 1) return null
    const card = movingCards[0]!
    if (card.suit !== to.suit) return null

    const pile = state.foundations[to.suit]
    if (!canPlaceOnFoundation(pile, card)) return null

    return { ...state, foundations: { ...state.foundations, [to.suit]: [...pile, card] } }
  }

  return null
}

export function applyMove(state: GameState, command: MoveCommand): GameState {
  const { from, to } = command
  if (isSamePile(from, to)) return state

  const extraction = extractMovingCards(state, from)
  if (!extraction) return state

  const placed = placeMovingCards(extraction.stateAfterRemoval, to, extraction.movingCards)
  if (!placed) return state

  const delta = scoreForMove(from.type, to.type) + (extraction.flipped ? TABLEAU_FLIP_BONUS : 0)
  const score = applyScoreDelta(placed.score, delta)
  const status = hasWon(placed.foundations) ? 'won' : placed.status

  return { ...placed, score, status, moveCount: state.moveCount + 1 }
}
