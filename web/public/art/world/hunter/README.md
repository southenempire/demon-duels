# Hooded Hunter — world sprites v1

Player character for the Underworld stealth world, built to the stealth spec's art section.

## World sprites (top-down ¾ view)
- `world/hunter/<anim>.png`: 48×48 frames. **Rows: down, left, right, up.** Columns are frames, left to right. Left is the right row mirrored.
- `2x/<anim>.png`: the same layout at 96×96 for HiDPI or zoomed cameras.
- Pivot (24, 46): the feet. Draw at `(x - 24, y - 46)` with image smoothing off. Standing height is about 40 px against 32 px tiles.
- `manifest.json`: frame counts, fps or per-frame durations, loop flags and impact frames.

| Anim | Frames | Timing | Loop |
|---|---|---|---|
| idle | 4 | 4 fps | yes |
| walk | 6 | 10 fps | yes |
| sneak | 6 | 7 fps (deep crouch) | yes |
| sprint | 6 | 14 fps | yes |
| takedown | 6 | 120/110/110/140/200/160 ms, impact frame 3 | no |
| strike | 8 | 80/90/110/70/140/110/120/140 ms, impact frame 4 | no |
| hide | 2 | 2 fps (cloaked mound) | yes |

Strike starts the onchain duel at its impact frame. Takedown removes a thrall. Timing is visual only; game events stay authoritative.

## Duel-scale set (`duel/`)
Side-view, right-facing 512×512 frames on the same canvas and root (224, 472) as the demon roster, for the finisher, cutscenes or duel screen: idle 4, walk 6, sneak 6, run 6, strike 6, hit 3, finisher 6. Horizontal strips; see `duel/manifest.json`. Play the finisher only after `demon-duels:settled` with `won: true`.

## Provenance
Original AI-assisted artwork generated for Demon Duels from one base design, background-isolated, scaled and foot-aligned. No third-party sprites or logos.
