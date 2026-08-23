// Single source of truth for the card-move animation duration, shared by
// CardAnimationLayer's CSS transition and the store's input-lock timeout.
// Keeping these in one place avoids the two drifting out of sync.
export const CARD_MOVE_ANIMATION_MS = 280
