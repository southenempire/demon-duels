# Ash Gate prototype

Open the app root or `?world=3d` for Ash Gate. `?world=arena` opens the standalone duel arena; duel invite URLs still open the invited room.

Use WASD to move, drag to look, Shift to run, and C or Ctrl to crouch. Space jumps in the open and mantles to a rooftop at the Climb prompt. Other hunters appear when they visit the same circle; press F near another hunter to send a PvP challenge.

Flank the Ash Warden and press E (or click Strike) to enter the devnet duel. Stealth grades change the Warden's move tendencies and what intel appears in the arena. The first seal is saved only after the confirmed Warden win's finisher completes. A PvP result never grants a seal.

The `demon-duels:launch` boss event carries `{ opponentKind: 0, mode: 'chain', returnToMap: true, grade, tells }`. A delivered `demon-duels:finisher` event carries `{ opponentKind, grade, duel }`. A 3D playback handler can call `preventDefault()` to replace the fallback and reply with `demon-duels:finisher-done` carrying `{ opponentKind, duel }` once playback finishes.

## Optional model assets

Place self-contained GLBs in `web/public/models/`. Both assets use meters, origin at the feet, and face +Z. If an asset is missing, the procedural character remains visible. Clip names are matched case-insensitively; missing clips use Idle.

| Asset | Height | Budget | Clips |
| --- | --- | --- | --- |
| `hunter.glb` | 1.85 m | One skinned mesh, ≤15k triangles, ≤3 MB | Idle, Walk, Run, Crouch, CrouchWalk, Climb, Strike (one-shot), optional Death |
| `ash-warden.glb` | 3.0 m | ≤20k triangles, ≤4 MB | Idle, Walk, Alert, Death (one-shot) |

Keep animations in place; the world handles locomotion, climbing displacement and strike timing.
