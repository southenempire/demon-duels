# Demon Duels — sound pack manifest

Two original loops and ten gameplay cues. The **Gate of Ash** menu loop holds the shared three-note bell motif over a low drone; **The Pit Opens** puts that motif over syncopated drums and a distorted pluck. A rising glass overtone makes the VRF crit audible even when the fight music is playing.

## Asset → game event

Each basename has an `ogg/<basename>.ogg` (Vorbis) and a `wav/<basename>.wav` (PCM) version. The last column is the start of the cue in the separate audition MP3; that reel is not a game asset.

| Basename | Duration | Trigger and placement | Audition |
|---|---:|---|---:|
| `music_menu` | 17.143 s | Loop on landing, vault, and pre-fight lobby after audio is enabled. | 0:00.0 |
| `music_fight` | 17.143 s | Crossfade in when both cards are in play and move selection opens; keep it through the wait and animated resolution. | 0:09.0 |
| `sfx_stake` | 0.56 s | Play when the local card lands in escrow after confirmed `openDuel` or `joinDuel`; in practice, use only if a local placement is animated. | 0:17.9 |
| `sfx_seal` | 0.52 s | Play when the local player's Private ER `lock` succeeds, or when a practice pick is accepted. Do not vary by move or use on opponent selection. | 0:18.9 |
| `sfx_attack_rend` | 0.37 s | Play on the revealed Rend (move 0) claw wind-up; slash accent starts around +120 ms. | 0:19.8 |
| `sfx_attack_ward` | 0.49 s | Play on the revealed Ward (move 1) animation; shield rings around +150 ms. | 0:20.6 |
| `sfx_attack_hex` | 0.57 s | Play on the revealed Hex (move 2) cast; dissonant bloom around +190 ms. | 0:21.5 |
| `sfx_hit` | 0.40 s | Play at contact or the damage-number pop for a non-critical strike. | 0:22.5 |
| `sfx_vrf_crit` | 0.76 s | Play **instead of** the normal hit at contact if the attacking side's resolved crit flag is true. Not a generic VRF-pending or tiebreak cue. | 0:23.3 |
| `sfx_victory` | 2.18 s | Play once when the result shows the local player won, after the combat beats. | 0:24.4 |
| `sfx_defeat` | 2.20 s | Play once when the result shows the local player lost, after the combat beats. | 0:27.0 |
| `sfx_card_transfer` | 0.98 s | Play once when the confirmed transfer is presented to the winner (card lands in the vault or ownership badge appears). No practice, pending, or refund cue. | 0:29.6 |

## Playback

- **Trust the result.** For devnet combat, gate attack, hit, crit, and stingers on `readDuel(key).phase === 3`. Read `moves` and `crits` in the same side order; use the local side when choosing a stinger. In practice, use the local `resolve()` result. Settlement transfers ownership in the same transaction; use the UI reveal of that confirmed transfer, not a timer or an Explorer indexing event, to trigger its cue.
- **Trigger edges, not renders.** Deduplicate by duel/round and animation beat. Do not replay confirmations from polling or when reopening a settled room. Spectators do not hear a personal victory/defeat. Keep the existing mute preference; resume the audio context from a user gesture, and stop playback on mute.
- **Loop exactly.** Both tracks are 112 BPM, 8 bars of 4/4, with tails wrapped into the downbeat, cut to 822,857 frames at 48 kHz. Set Web Audio `source.loop = true`, `loopStart = 0`, `loopEnd = 822857 / 48000` (or use the exact WAV buffer). Avoid manually restarting playback on a timer. Start with a 300 ms menu-to-fight crossfade.
- **Mix for the cues.** Suggested linear gains: menu 0.32, fight 0.28, effects 0.72, stingers 0.63. Duck music to about 0.10 under stingers. If the transfer has its own animation beat, let the stinger's opening flourish pass before playing it; do not delay the actual wallet update.
- **Ship one format per cue.** The 12 OGGs together are about 0.57 MiB. Use those as web assets where supported and WAV as the fallback or edit master. Both formats are 48 kHz stereo; WAV is 16-bit PCM. In the snapshot's Vite app, a new `web/public/audio/` folder would keep these separate from the original `art/seal.ogg` and `art/strike.ogg` placeholders.

## Provenance and rights

All compositions, instruments, and effects were made for Demon Duels from oscillator synthesis and filtered noise. No recordings, sample packs, third-party compositions, voices, or content-library assets were used. The audio in this pack is dedicated under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) to the extent rights exist; no attribution is required. The dedication does not apply to the Demon Duels name, art, or code.
