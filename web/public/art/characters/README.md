# Demon Duels — roster art v1

Six original demon designs, each with **idle, attack, hit, crit, defeat, and card portrait** artwork. The combat images are distinct keyed poses, not a hand-drawn frame-by-frame animation. The game can combine them with anticipation, lunges, hitstop, recoil, elemental particles, and camera feedback.

| Game number | Zero-based demon ID | Asset ID | Demon | Affinity |
|---|---|---|---|---|
| 01 | 0 | `ash-warden` | Ash Warden | Infernal |
| 02 | 1 | `void-wraith` | Void Wraith | Abyssal |
| 03 | 2 | `marrow-king` | Marrow King | Boneborn |
| 04 | 3 | `mire-phantom` | Mire Phantom | Venomous |
| 05 | 4 | `frost-herald` | Frost Herald | Glacial |
| 06 | 5 | `gloam-shade` | Gloam Shade | Spectral |

Order, names, and element labels verified against the six-entry roster array in the live game client at `https://characteristics-producer-devel-excuse.trycloudflare.com/assets/main-BL5NF-mm.js`. `manifest.json` is in that exact order; `demonId` is zero-based and `displayId` is the two-digit game number. Do not infer IDs from alphabetical folder order. Gloam uses electric cyan for spectral readability, and Mire uses acid yellow-green for venom; these intentionally replace the old hue-shifted placeholder palettes without changing their element identities.

## Files

- Each character folder contains six transparent **512×512 RGBA PNGs**: `idle.png`, `attack.png`, `hit.png`, `crit.png`, `defeat.png`, `portrait.png`.
- `atlas.png` is a **1536×1024**, three-column/two-row atlas. Row-major order: idle, attack, hit, crit, defeat, portrait.
- `atlas.json` gives untrimmed named atlas rectangles, content bounds, source dimensions, and normalized pivot.
- Root `manifest.json` maps names, affinities, accent colors, file paths, timing suggestions, and state sequences.
- `roster-preview.png` and `all-poses.png` are reference boards, not runtime assets.

## Placement

All combat sprites face **right** and share ground/root pivot **(224, 472)** in the 512×512 canvas, normalized **(0.4375, 0.921875)**. Preserve this transparent padding: it reserves room for extended weapons and critical effects without changing the character's body scale. The root is intentionally left of center to leave attack reach in front of the fighter.

Canvas placement at world `(x, y)`:

```js
ctx.save();
ctx.translate(x, y);
ctx.scale(facingLeft ? -scale : scale, scale);
ctx.drawImage(sprite, -224, -472);
ctx.restore();
```

For other renderers, mirror around the **root**, not around the image center. Do not independently crop/fit each pose or use `object-fit: cover` for combat images; both break alignment. Portraits are chest-up compositions and do not use the combat root.

## Suggested timing

| Action | Keyed-pose sequence | Timing |
|---|---|---|
| Idle | idle | Loop, subtle 2–4px breathing/bob |
| Attack | idle → attack → idle | 90ms anticipation, 150ms strike, 160ms recover |
| Hit | hit → idle | 170ms recoil, 120ms recover |
| Critical | idle → crit → attack → idle | 130ms charge, 220ms impact, 100ms follow-through, 180ms recover |
| Defeat | hit → defeat | 140ms recoil, then hold defeat until reset |

Animation timing is a visual suggestion, not combat authority. The consuming game must trigger it from its actual match events/results. Keep hit flashes, particles, camera shake, and CRT overlays outside these sprites so the art stays reusable and readable.

## Provenance

Original AI-assisted character artwork generated for this Demon Duels handoff, then chroma-isolated, edge-cleaned, aligned, and packaged. No third-party character sprites or logos are included. Transparent PNGs use straight alpha and no baked-in scene background. Source generation sheets are intentionally excluded from runtime files.
