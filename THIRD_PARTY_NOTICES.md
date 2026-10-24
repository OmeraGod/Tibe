# Third-party source included in tibe

## Concat

Repository: https://github.com/jub0t/Concat

Pinned commit: `797c8c707be5f2c798bb99e0fffad20612552510`.

Copyright 2026 Jareer Abdullah and Concat contributors.

The original package definitions and WGSL/Rust reference sources in `third_party/concat`, and the derivative JavaScript color port in `assets/js/concat-looks.js`, are under **AGPL-3.0-or-later**. The complete license is included at `third_party/concat/LICENSE`. Modified adaptation: display-space pixel formulas translated to JavaScript and sampled as SDR LUTs for the tibe renderer. The pinned originals are retained; `UPSTREAM.json` records their source hashes.

The source archive includes the integrated editor, server, adapter, tests, original package source and modified port for review and source availability. Distribution of this integrated work must retain the applicable AGPL notices and source obligations. No CapCut-owned resource files are included.

## VieNeu-TTS — embedded speech runtime

Project: https://github.com/pnnbao97/VieNeu-TTS

Model: https://huggingface.co/pnnbao-ump/VieNeu-TTS-v3-Turbo

Author: Phạm Nguyễn Ngọc Bảo. SDK version pinned to `vieneu==3.8.3`. The model card identifies the model weights and bundled preset voices as Apache-2.0. The model uses the OpenMOSS MOSS-Audio-Tokenizer-Nano codec and sea-g2p phonemizer; their upstream notices are retained in the installed runtime/model packages. A copy of the VieNeu Apache-2.0 license is in `third_party/vieneu/LICENSE`.

The current machine has a prepared runtime in `.runtime/voice-env` and cached models in `.runtime/models`. The source ZIP excludes both and installs/downloads them on first launch. tibe's worker and runtime management are separate integration code; no CIT installer/application source is included. Keep all applicable upstream notices when distributing a prepared runtime.

## CIT Voice Studio — legacy API compatibility

Official project: https://github.com/Cuongyd196/cit-voice-studio

CIT's public repository provides documentation/installers, not the application source. The earlier optional documented API client remains for compatibility. The current tibe interface directly uses VieNeu, without a CIT server or connection form. No CIT application code or installer is redistributed.

## REA and local CapCut algorithm adaptations

REA dependency: `rea-agents@6.7.0`, https://github.com/morluto/rea. It is installed through the pinned npm lockfile; retain the package's own notices when redistributing node_modules.

Three identified shader algorithms from the user's local CapCut cache are adapted into tibe Canvas rendering: grain, 15-tap directional blur and weighted 17-tap soft blur. This produces five presets. Their source fingerprints and read-only REA inventories are written under `workspace/rea` on the current machine; the fingerprints also accompany the adaptations. CapCut remains its owners' product. These formulas do not reconstruct the original multi-pass engine or grant rights to its other assets. No original CapCut shader, Lua file, executable, model, cache or commercial effect pack is included in the source archive. This section does not relicense those original materials under Concat's or VieNeu's licenses.

## GL Transitions

Source: https://github.com/gl-transitions/gl-transitions. Pinned npm package **1.76.1**, tarball SHA-1/integrity and upstream commit recorded in `third_party/gl-transitions/UPSTREAM.json`.

Copyright (c) 2017-present gl-transitions contributors. Package license: MIT, retained at `third_party/gl-transitions/LICENSE`. Each original shader retains its author and license comments in the original JSON and the embedded catalog. `InvertedPageCurl` carries Hewlett-Packard's BSD 3-Clause notice and `StereoViewer` carries Theodore K Schundler's BSD 2-Clause notice; both full notices are retained verbatim with their shaders. Do not remove these notices when redistributing.

Integration changes: 122 self-contained shaders selected; JavaScript WebGL 2 wrapper, Canvas compositing and bounded program cache added; GLSL ES 1.00 `texture2D` spelling converted to ES 3.00 `texture` at runtime. The original shader bodies remain in `assets/js/gl-transition-catalog.js` and the upstream reference JSON. No claim that these are CapCut transitions. Additional 40 CSS grades and 24 Canvas effects in tibe are separate original implementations.

## Omera typography

Plus Jakarta Sans and Playfair Display variable fonts are included from the Google Fonts repository under the SIL Open Font License 1.1. Full copyright and license notices are retained at `assets/fonts/plusjakartasans-OFL.txt` and `assets/fonts/playfairdisplay-OFL.txt`. `assets/fonts/SOURCES.json` records the exact download locations and SHA-256 checksums. No font files were modified.

## Native Canvas

`@napi-rs/canvas` is pinned to **0.1.100** in the npm lockfile. Its MIT license is retained at `third_party/napi-rs-canvas/LICENSE`. The installed binary packages contain their applicable Skia and bundled dependency notices; preserve those when distributing a prepared runtime. The source ZIP excludes node_modules and installs from the lockfile.

## Omera procedural edit sounds

The five files under `assets/sfx` are generated by `scripts/build_omera_sfx.py` from oscillators and seeded noise. They do not contain CapCut or commercial sound library recordings. `assets/sfx/SOURCES.json` records their provenance. The Omera Canvas widgets and presets are tibe implementation code.
