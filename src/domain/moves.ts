import type { Card, Suit } from './cards'
import type { GameState } from './deal'
import { canPlaceOnFoundation, canPlaceOnTableau, isValidTableauRun } from './rules'

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

  return { ...state, stock, waste: [], moveCount: state.moveCount + 1 }
}

export function clickStock(state: GameState): GameState {
  return state.stock.length > 0 ? drawFromStock(state) : recycleWaste(state)
}

function extractMovingCards(
  state: GameState,
  from: PileRef,
): { movingCards: Card[]; stateAfterRemoval: GameState } | null {
  switch (from.type) {
    case 'stock':
      return null

    case 'waste': {
      if (state.waste.length === 0) return null
      const card = state.waste[state.waste.length - 1]!
      return {
        movingCards: [card],
        stateAfterRemoval: { ...state, waste: state.waste.slice(0, -1) },
      }
    }

    case 'foundation': {
      const pile = state.foundations[from.suit]
      if (pile.length === 0) return null
      const card = pile[pile.length - 1]!
      return {
        movingCards: [card],
        stateAfterRemoval: {
          ...state,
          foundations: { ...state.foundations, [from.suit]: pile.slice(0, -1) },
        },
      }
    }

    case 'tableau': {
      const column = state.tableau[from.column]
      if (!column) return null

      const cardIndex = from.cardIndex ?? -1
      const card = column[cardIndex]
      if (!card || !card.faceUp) return null

      const movingCards = column.slice(cardIndex)
      if (!isValidTableauRun(movingCards)) return null

      const tableau = [...state.tableau] as GameState['tableau']
      tableau[from.column] = flipExposedTopCard(column.slice(0, cardIndex))

      return { movingCards, stateAfterRemoval: { ...state, tableau } }
    }
  }
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

  return { ...placed, moveCount: state.moveCount + 1 }
}
