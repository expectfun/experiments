# Words become worlds

An animated typographic journey built in Happy, with an original score synthesized in the browser.

[Watch online](https://expectfun.github.io/experiments/words-become-worlds/).

## Watch

Select **Sound off** to enable the music; **Play/Pause** controls playback. When invited, type or tap the letters of LIGHTHOUSE to continue, or choose **Watch instead**. The player supports seeking, replaying, and toggling music. Audio starts after a user gesture, as required by browsers. Desktop and mobile browsers need WebGL and Web Audio support.

## Run and publish

`index.html` is the complete production app, with its graphics library, font data, and score embedded. It needs no build step, backend, API keys, CDN, or external media. The Happy link opens `https://happy.engineering/` only when selected.

Serve the repository root locally, for example with `python3 -m http.server 8000`, then open `http://localhost:8000/words-become-worlds/`.

GitHub Pages publishes this repository from the root of `main`. Merging this directory into `main` publishes it at `/experiments/words-become-worlds/` after the Pages deployment completes. Updates replace `index.html` and retain the accompanying license notices.

## Credits

- Fable authored the original composition, instruments, synthesis, and musical cues.
- GPT-6.1 Sol built the scene, playback transport, and integration.
- Three.js and the embedded Gentilis font data are distributed under the MIT and SIL Open Font licenses, respectively. See [LICENSES.txt](LICENSES.txt) for the full notices.