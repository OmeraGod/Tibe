# Concat in tibe 3.3.1

Upstream: [jub0t/Concat](https://github.com/jub0t/Concat), pinned at
`797c8c707be5f2c798bb99e0fffad20612552510` (0.2.8 source tree).

## Included and running inside tibe

- 25 original audio package definitions, loaded directly from the vendored `effect.toml` files. The adapter evaluates only the numeric expression subset used by these pinned packages and sends the resulting filter chain to FFmpeg as an argument, without a shell. It accepts no filter chain from the browser.
- 16 display-space, pixel-local color formulas translated from the original WGSL and its display color helpers into `assets/js/concat-looks.js`. They are sampled into 33³ SDR LUTs, then used by the same trilinear renderer for library thumbnails, the viewer and video export. The strength control interpolates with the original picture. LUT sampling is an approximation of the continuous shader, not a GPU shader engine.
- The original files, full AGPL license and a SHA-256 manifest remain in `third_party/concat`. The JavaScript adaptation declares the upstream copyright and AGPL license.

Imported color formulas: Autumn, Bleach Bypass, Bronze, Classic Chrome, Contrast Pop, Cool, Cyberpunk, Delicious, Retro 70s, Rosy, Sci-Fi, Silver, Tropical, Vaporwave, Warm, Winter Cool.

Audio: noise reduction, loudness normalization, voice enhancement, bass, bright, treble, pitch, deep, chipmunk, sweet, robot, telephone, radio, megaphone, lo-fi, distorted, underwater, vinyl, whisper, echo, room, hall, cathedral, plate and stadium.

Use **Filters → Concat** or **Audio → Xử lý âm thanh · Concat**. An 8-second preview is separate from full processing. Apply is enabled only after full processing; it adds a new library asset. Applying to an audio clip preserves its trim, start and speed. Applying to a selected video extracts its processed sound and mutes the original clip. Undo retains the previous state.

## Bounds and verification

Two simultaneous audio operations, up to ten minutes per source; inputs are restricted to app media. Processing produces 48 kHz stereo PCM WAV, trimmed to source duration, including a capped echo tail. The original media is retained. Offline rendering needs FFmpeg and FFprobe; Concat itself need not be installed.

`tests/test_projects_concat.py` renders all 25 packages through FFmpeg. `tests/concat-looks.test.cjs` checks 640 color samples against the ported formulas (observed maximum LUT interpolation/quantization error 0.71/255 for those samples). This is a sampled SDR verification, not a statement of exact shader equality for every pixel.

## Not imported

The native Rust/GPU engine, native project schema, Whisper captions, model downloads, automatic cutout and HDR pipeline are not embedded in tibe. Existing tibe transitions and animated effects remain its own renderer; they are not relabeled as Concat features. The interface has no inactive pretend buttons for these native functions.
