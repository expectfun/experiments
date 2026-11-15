# Words become worlds

An animated typographic journey built in Happy, with an original score by Fable 5.2.

[Watch online](https://expectfun.github.io/experiments/words-become-worlds/).

## Watch

Choose **Enter with sound** to prepare the original score and begin the film with music from the start, or **Watch silently** to begin without audio. **Play/Pause** controls playback. When invited, type or tap the letters of LIGHTHOUSE to continue, or choose **Watch instead**. The player supports seeking, replaying, and toggling music. Audio starts after an explicit sound choice, as required by browsers. Desktop and mobile browsers need WebGL and Web Audio support.

## Run and publish

`index.html` contains the production app, graphics library, and font data. The `audio/` directory holds compressed cues rendered ahead of time from Fable's original synthesis, so playback can load and decode them without synthesizing the full score on the viewer's device. It needs no build step, backend, API keys, or CDN. The Happy link opens `https://happy.engineering/` only when selected.

All 15 cues load and decode in parallel after an explicit sound choice. Idle and silent visits make no audio requests. Playback waits for the cues to be ready and starts the film and score together at zero. If a sound load fails, retry or choose **Watch silently**. [The audio manifest](audio/manifest.json) records cue sizes, hashes, and provenance.

Serve the repository root over HTTP so the browser can fetch the audio, for example with `python3 -m http.server 8000`, then open `http://localhost:8000/words-become-worlds/`.

GitHub Pages publishes this repository from the root of `main`. Merging this directory into `main` publishes it at `/experiments/words-become-worlds/` after the Pages deployment completes. Updates include `index.html`, its `audio/` cues, and the accompanying license notices. Relative audio paths support the Pages subdirectory.

## Credits

- Fable 5.2 authored the original composition, instruments, synthesis, musical cues, and score playback body. The compressed cues are renders of that score.
- GPT-6.1 Sol built the scene, playback transport, audio asset encoding/loading, and integration.
- Three.js and the embedded Gentilis font data are distributed under the MIT and SIL Open Font licenses, respectively. See [LICENSES.txt](LICENSES.txt) for the full notices.