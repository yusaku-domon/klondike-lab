// Single source of truth for the card-move animation duration, shared by
// CardAnimationLayer's CSS transition and the store's input-lock timeout.
// Keeping these in one place avoids the two drifting out of sync.
export const CARD_MOVE_ANIMATION_MS = 280

// Same idea, but only for "Auto Complete" cascade steps: 1.5x the normal
// pace. Kept as its own constant (not a derived multiplier applied at the
// call sites) so CardAnimationLayer's CSS transition and the store's
// per-step cascade timeout can share this one value the same way the pair
// above does — a manual move never reads this constant.
export const AUTO_COMPLETE_CARD_MOVE_ANIMATION_MS = Math.round(CARD_MOVE_ANIMATION_MS / 1.5)
