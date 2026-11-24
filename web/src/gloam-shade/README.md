# Gloam Throne

Circle VI is demon id 5. The player arrives in the lamplit west aisle of an
obsidian sanctum. The central nave and east cloister are patrol territory.
Three west roofs climb from the entry light to the upper gallery; the far
edge drops into a lit aisle. Follow the ivory inlay across the nave, then
north along the last band of light to reach the Gloam Shade's flank.

## Ash Gate engine descriptor

`index.js` default-exports the level for `mountCircle(descriptor)` and
`?world=3d&circle=5`. Coordinates are in world units, with ground at Y = 0.

| Field | Shape |
| --- | --- |
| `id`, `opponentKind` | Both `5`; the journal gate is the fifth sequential seal, id `4`. |
| `name`, `chapter`, `objective` | Display strings for the title and HUD. |
| `scenery(T, scene)` | Builds the room and returns `{ limits, colliders, ledges, roofs, coverZones, barriers }`. `limits` is `{ left, right, far, near }`; geometry lists use centered XZ rectangles `{ x, z, w, d, h }`. `h` is the top of solids and the floor elevation of light zones. |
| `spawn`, `boss` | `spawn: { x, z }`, `boss: { model, height, pos: { x, z }, facing }`; facing is the Ash Gate yaw in radians. |
| `patrols` | `{ route: [[x, z], ...], yaw }` entries; routes loop. |
| `palette`, `fog`, `audio` | `{ background }`, `{ color, density }`, `{ footstep }`; ambience follows circle id 5. |
| `hooks.concealedAt(pos)` | Returns true only inside an illuminated rectangle at the hunter's current elevation (`height` or `y`). This replaces Ash Gate's ash/roof concealment rule, not the usual stone occlusion; a dark roof is not automatically safe. |

The shared mount should dispatch cancelable `demon-duels:launch` on Strike
with `{ opponentKind: 5, mode: 'chain', returnToMap: true }` (exported as
`GLOAM_STRIKE`). It owns the arena handoff and return. The descriptor
does not write clears; status follows the campaign journal after the
matching bound chain settlement and finisher.
