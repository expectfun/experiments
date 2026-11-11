# Shadow test

A Three.js challenge inspired by the cover of *Gödel, Escher, Bach*: a suspended sculpture should cast HAPPY on the floor, AGENT on the left wall, and CODER on the right wall, all readable together.

The [project page](index.html) includes three interactive builds and their creation histories. It is a project notebook, not a controlled model ranking: the builds used different processes.

| Build | Process | Observed result |
| --- | --- | --- |
| Iterated reference | Multiple revisions and visual feedback | Three readable words in the settled view |
| Fable 5.2 → GPT-6.1 Sol | Fable at low effort; its turn failed, then a manual switch to Sol completed it; tool-assisted internal iterations | Three readable words, but the sculpture itself looks letter-like |
| Grok 4.7 | Low effort, one response, no tool calls; an additional soft 5,000-output-token target | Renders and includes controls, but no word shadows appear in the settled view |

See the [v4 task prompt](prompt-v4.md), [Grok's additional budget instructions](grok-budget.txt), and [provenance and token counters](provenance.json). Low effort and a requested output target did not enforce a small total token budget. Reported token counters are not prices or subscription quota percentages.

## Run locally

From this directory:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000/>. Select a version, then **Explore this version**. Drag to orbit, scroll to zoom, or use the scene's camera buttons.

Opening `index.html` directly from disk shows the overview, but browsers generally block the local ES modules used by interactive demos. Use the local server for exploration.

## Preserved submissions and dependencies

`mixed/original.html` and `grok/original.html` preserve the delivered HTML unchanged. Their playable `index.html` copies only replace CDN import URLs with bundled paths. No scene fixes were made for publication.

The reference retains its existing Three.js 0.187.0 package. The other two demos use the requested Three.js 0.170.0, bundled under `mixed/three/` and shared by Grok. Each bundle includes its MIT license. No build step or CDN is needed for the playable demos.

The page was assembled in Happy. No new model generation was used to create the comparison page.