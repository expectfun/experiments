# Living Glass · Bring Back the Light

A small stained-glass puzzle built in Happy with Three.js. Eight pieces have fallen out of a gothic window. Match their rotated silhouettes to the empty openings and bring back the colored light.

[Play online](https://expectfun.github.io/experiments/living-glass/).

## Play

Click or tap a loose piece, then its opening. Dragging also works. Imagine rotating the piece to compare shapes; a helper moth turns a correct match into place. Wrong matches return without progress. Three helpers can deliver at once.

Restore all eight pieces to reveal the Happy smile. Restart with the arrow or R; Escape clears selection. No timer, score, backend or runtime model calls.

## Build

The root contains the ready-to-serve production build. Editable Vite/TypeScript source and the dependency lockfile are in `source/`.

```sh
cd source
npm ci
npm run dev
```

`npm run build` writes `source/dist/`. To update the published game, copy its `index.html` and `assets/` to this directory, replacing the previous generated assets. Relative asset paths support GitHub Pages subdirectories.

## Creation

- Fable 5.2 built the scene, shaders, animation and game logic.
- Local Qwen 3.8 27B supplied a small seeded site generator, with coordinator-added TypeScript types.
- GPT-6.1 Sol coordinated the build, supplied Voronoi clipping, refined pointer/touch input and mental rotation, and verified the game in a browser.

Attempts to delegate the full geometry module to the local model did not deliver code. This experiment does not demonstrate net token or financial savings.

Verified on desktop and portrait touch: wrong matches, all eight correct placements, three concurrent helpers, restart, replay and dragging. Loose pieces retain their angles after a wrong attempt and align on correct seating.

Three.js is bundled under its MIT license; see [THREE-LICENSE.txt](THREE-LICENSE.txt).