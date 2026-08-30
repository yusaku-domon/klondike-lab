# Klondike Lab

An offline-first Klondike Solitaire PWA built with Vue 3 and TypeScript.

**Play it here: https://yusaku-domon.github.io/klondike-lab/**

Install it from the browser and it keeps working with no connection at all.

## Features

- Classic Klondike rules, playable by click/tap or drag-and-drop
- Undo, pause/resume, and auto-complete once the board is fully revealed
- Optional move-navigation hints highlighting legal destinations for the current selection
- Seed-based games — start a specific deal and see your last 5 results (win/lose)
- Switchable card designs (Classic, Saul Spatz)
- Installable, fully offline via a PWA service worker; progress is saved locally between sessions

## Tech stack

Vue 3 (`<script setup>`) + TypeScript (strict) + Vite + Pinia + vite-plugin-pwa, tested with Vitest.

## Development

```bash
npm install
npm run dev        # start the dev server
npm run typecheck  # vue-tsc --noEmit
npm test           # run the test suite
npm run build      # production build
npm run preview    # serve the production build locally
```

## Credits

Third-party assets (font, card deck, board texture) are documented in
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) and in `SOURCE.md` files
alongside the assets themselves under `public/` and `src/assets/`.
