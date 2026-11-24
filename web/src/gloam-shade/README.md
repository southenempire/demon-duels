# Gloam Throne

Circle VI is demon id 5. The player arrives in the lamplit west aisle of an
obsidian sanctum. The central nave and east cloister are patrol territory.
Three west roofs climb from the entry light to the upper gallery; the far
edge drops into a lit aisle. Follow the ivory inlay across the nave, then
north along the last band of light to reach the Gloam Shade's flank.

## Ash Gate engine descriptor

`index.js` exports `GLOAM_SHADE` for `mountCircle(descriptor, options)` and
`?world=3d&circle=5`. Coordinates are in world units, with ground at Y = 0.

| Field | Shape |
| --- | --- |
| `id`, `opponentKind` | Both `5`; the journal gate is the fifth sequential seal, id `4`. |
| `name`, `chapter`, `objective`, `copy`, `tells` | World title and chapter, a position-aware HUD objective, story feedback, and stealth-grade duel intel. |
| `scenery(T, scene)` | Builds the room and returns `{ limits, colliders, ledges, roofs, coverZones, barriers, cameraBlockers }`. `limits` is `{ left, right, far, near }`; geometry lists use centered XZ rectangles `{ x, z, w, d, h }`. `h` is the top of solids and the floor elevation of light zones. |
| `spawn`, `boss` | `spawn: { x, z }`, `boss: { model, height, pos: { x, z }, facing }`; facing is the Ash Gate yaw in radians. |
| `patrols` | `{ route: [[x, z], ...], facing }` entries; routes loop. |
| `palette`, `fog`, `audio` | `{ background }`, `{ color, density }`, `{ footstep }`; ambience follows circle id 5. |
| `hooks.concealedAt(pos)` | Returns true only inside an illuminated rectangle at the hunter's current elevation (`pos.y`). This replaces Ash Gate's ash/roof concealment rule, not the usual stone occlusion; a dark roof is not automatically safe. |
| `hooks.canTraverse(pos)` | Blocks movement through a roof below its surface. Roofs block the camera but not 2D sight rays, which would otherwise treat every rooftop as concealed. |

The shared mount dispatches cancelable `demon-duels:launch` on Strike
with `{ opponentKind: 5, mode: 'chain', returnToMap: true }` and the world
and stealth metadata. It owns the arena handoff and return. The descriptor
does not write clears; status follows the campaign journal after the
matching bound chain settlement and finisher.
