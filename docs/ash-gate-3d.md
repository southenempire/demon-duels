# Ash Gate prototype

Open the app root or `?world=3d` for Ash Gate. `?world=arena` opens the standalone duel arena; duel invite URLs still open the invited room.

Use WASD to move, drag to look, Shift to run, and C or Ctrl to crouch. Press Space at a climb prompt to mantle to a roof; walk over an edge to drop back to the street. Flank the Ash Warden and press E (or click Strike) to enter the devnet duel. Only a confirmed settlement for that Warden duel changes the world outcome.

## Optional model assets

Place self-contained GLBs in `web/public/models/`. Both assets use meters, origin at the feet, and face +Z. If an asset is missing, the procedural character remains visible. Clip names are matched case-insensitively; missing clips use Idle.

| Asset | Height | Budget | Clips |
| --- | --- | --- | --- |
| `hunter.glb` | 1.85 m | One skinned mesh, ≤15k triangles, ≤3 MB | Idle, Walk, Run, Crouch, CrouchWalk, Climb, Strike (one-shot), optional Death |
| `ash-warden.glb` | 3.0 m | ≤20k triangles, ≤4 MB | Idle, Walk, Alert, Death (one-shot) |

Keep animations in place; the world handles locomotion, climbing displacement and strike timing.
