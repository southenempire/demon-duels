# Demon Duels: The Unnamed Hunter

The story and cutscene script for the Underworld Hunt. It follows the design spec v1: its circle names, the Pit hub, the Ghost, Shadow and Exposed grades, the cutscene ids and the bounty board. Every spoken line is 90 characters or fewer, so it works as a subtitle, and has a stable ID that the world, finisher and cutscene modules can key on.

The world uses the spec's realm names (Ash Gate, Hollow Rift, and so on). The boss quotes and victory lines are the ones in `campaign.js` from the fallback campaign (PR #3), so the two read as the same story. Only the place names differ.

**Demo budget.** The `intro` cutscene runs about 35 seconds, each `circle-<n>-enter` about 6 seconds, each `circle-<n>-clear` about 8 seconds and the `outro` about 40 seconds. Every cutscene can be skipped (Esc or tap), so the 5-minute judge run loses no time to the story.

## Cast

| Speaker | Who | Voice direction |
| --- | --- | --- |
| `PIT` | Narrator: the Underworld's hunger, older than the guardians. | Low, patient, amused. Never shouts. |
| `HUNTER` | The player. A hooded hunter of the Sealed Hand whose name was burned. | Few words, dry, cold. |
| `THRALL` | Patrolling thralls, the damned bound to serve each guardian. | Mumbled, scared of their masters. |
| `WARDEN` | Ash Warden, circle 0 | Crackling, proud, a jailer. |
| `WRAITH` | Void Wraith, circle 1 | Whispered, plural ("we"), mocking. |
| `KING` | Marrow King, circle 2 | Grand, courtly, rattling. |
| `PHANTOM` | Mire Phantom, circle 3 | Wet, sweet, coaxing. |
| `HERALD` | Frost Herald, circle 4 | Slow, calm, final. |
| `SHADE` | Gloam Shade, circle 5 | The hunter's own voice, distorted. |

No voice acting is assumed. Lines show as subtitles with the speaker tag. Each speaker can use one short sound from the CC0 pack as a voice sting.

## Logline

You are a hooded hunter whose name was burned at the gates of the Underworld. Six demon guardians each hold one rune of it. Stalk each guardian unseen, strike with a blade no one sees until it lands, and take its card. Break all six and the Pit's bounty board opens to every hunter.

## The hunter: backstory and motive

- **The Sealed Hand.** An order of demon hunters with one rule: never show your strike until it lands. Their blade is a move sealed in the dark and revealed only when both fighters have committed.
- **The burning.** The hunter came down to free the souls bound inside the guardians' cards. The Ash Warden caught them at the Ash Gate and burned their name into the gate fire. A soul with no name cannot leave the Underworld.
- **The Pit.** The hunter woke in the Pit, the arena at the heart of the Underworld where six gates lead to six circles. Its bounty board, where hunters stake demons against each other, is chained shut. Each guardian holds one chain.
- **The motive.** The burned name broke into six runes, one for each guardian. Win a guardian's card and its rune returns, and one chain falls. With six runes the hunter can be named, and the board is free.
- **The twist.** The Gloam Shade was the first hunter of the Sealed Hand. It chained the board so the Old Pact would answer only to it. It hunts in darkness because it taught the order to. Beating it does not make the hunter a new ruler. It breaks the last chain, and the Pit belongs to every hunter.

## The rules in the story's words

Use these terms in UI copy so the fiction explains what the chain does. Each one matches the current program and the spec.

| Story term | What actually happens |
| --- | --- |
| **The Hunter's Oath** | The free starter pack: `request_pack`, then MagicBlock VRF picks three distinct demon cards. |
| **Binding** a demon | Staking a card. It is locked to one duel and cannot be used anywhere else. |
| **The hidden blade** / **sealing** a move | Choosing Rend, Ward or Hex. The pick stays private inside MagicBlock's TEE until both fighters have sealed, then both are revealed together. |
| **Rend, Ward, Hex** | Rend claws through Ward, Ward reflects Hex, Hex curses Rend. 2 damage, +1 for advantage. |
| **The Omen** | VRF decides 25% crits (+2 damage) and breaks ties. |
| **The Old Pact** | The winner takes both cards. Ownership changes onchain at settlement. |
| **The boss fled** | The duel missed its deadline. `refund` returns the card and grants no progress. |
| **The Ledger** | Solana devnet. The settlement transaction proves the kill. |
| **Tells** | Intel about the house bot's move weighting. Offchain only; the sealed moves and the Omen stay onchain. |
| **Marked** | The hunter was caught. The guardian is Alerted for this run. No chain cost. |
| **An echo** | A practice strike or duel. Nothing is bound or claimed. |
| **The bounty board** | Open duels from other players. Challenge one with `join_duel`, or post a bounty with `open_duel`. |

## Cutscene `intro` (about 35 seconds)

Plays once, on the first world mount. It ends in the Pit at the Hunter's Oath.

| ID | Shot | Speaker | Line |
| --- | --- | --- | --- |
| `intro.01` | Black. A single rune of fire drifts down. | PIT | Every soul that falls here keeps one thing. Its name. |
| `intro.02` | The Ash Gate, burning. A hooded figure kneels before the Ash Warden. | PIT | Except you. |
| `intro.03` | The Warden's hand closes. Letters of fire peel off the hood into the gate. | WARDEN | No name, no way out. The fire thanks you. |
| `intro.04` | The name bursts into six runes that streak off toward six gates. | PIT | Your name broke into six runes. Six guardians caught them. |
| `intro.05` | The hunter wakes on the Pit floor. Six gates around it, a chained board above. | PIT | They chain the Pit. They keep every soul in their cards. |
| `intro.06` | Hood up. A blade slides out of the sleeve, then back. | HUNTER | Then I take them back. One rune at a time. |
| `intro.07` | Three cards rise from the ash, face down. | PIT | Swear the Hunter's Oath. The dark will choose three demons for you. |

**Handoff:** after `intro.07`, focus the Hunter's Oath in the Pit. If the wallet already owns cards, end on `intro.06` and focus the Ash Gate.

## The Pit (hub)

| ID | Trigger | Speaker | Line |
| --- | --- | --- | --- |
| `pit.oath` | Interact with the Hunter's Oath | PIT | Swear it, and three demons answer. The dark picks them, not you. |
| `pit.oath.pending` | Waiting for the VRF callback | PIT | The dark is choosing. Patience. |
| `pit.oath.done` | Pack opened | PIT | Three demons, bound to you. Spend them well. |
| `pit.oath.used` | Wallet already opened its pack | PIT | You swore the Oath once. The dark does not choose twice. |
| `pit.gate.locked` | Interact with a locked gate | PIT | Sealed. Break the circle before it first. |
| `pit.gate.open` | A gate opens (`gate-open`) | PIT | Another gate opens. Another rune waits below. |
| `pit.gate.final` | Gate 5 while circles 0 to 4 are not all cleared | PIT | The last gate opens for five runes. Not one fewer. |
| `pit.board.locked` | Bounty board before all six clears | PIT | Six chains. Six guardians. The board stays shut until they fall. |
| `pit.nocards` | No unlocked card in the wallet | PIT | Your vault is empty. The Pact took everything. Begin again as a new hunter. |

A wallet can open only one pack (its pack account is derived from the wallet), so `pit.oath.used` and `pit.nocards` never offer a second one.

Friend invites (`?room=<duel>`) skip the board's chains, as the spec says. Use this as the door prompt: `pit.friend` "Challenge a friend. Send the link. First to answer takes the duel."

## Tutorial prompts (circle 0)

Small on-screen text, not voiced. Each shows once, the first time the mechanic is in reach.

| ID | Shown when | Text |
| --- | --- | --- |
| `tut.move` | Spawn | WASD or arrows to move. Shift to sprint. Sprinting is loud. |
| `tut.sneak` | First thrall in view | C to sneak. Sneaking makes almost no noise. |
| `tut.light` | Near a lit brazier | Light gives you away. Stay in the dark. |
| `tut.douse` | Within reach of a brazier | E to douse the brazier and darken the lane. |
| `tut.hide` | Next to ash grass | Ash grass hides you. Nothing sees past one tile. |
| `tut.cone` | First vision cone on screen | Red cones are eyes. Keep out of them. |
| `tut.meter` | First time Suspicious | The eye fills as they notice you. Break line of sight to lose them. |
| `tut.takedown` | Behind an Unaware thrall | E to take down. Only from behind, only while they are unaware. |
| `tut.ember` | First ember picked up | F to throw an ember. Watchers go to look at the noise. |
| `tut.sight` | Boss lair entered | Hold Q for Hunter's Sight: guardian in gold, eyes in red, intel in blue. |
| `tut.vantage` | Vantage point in view | Climb the vantage point. E to read the whole circle. |
| `tut.leap` | On the vantage point | Space for a leap of faith into the hide zone below. |
| `tut.intel` | First intel scroll in view | Intel scrolls reveal the guardian's habits for the duel. |
| `tut.strike` | Strike prompt first appears | E to Strike. The duel starts, and your blade stays sealed until it lands. |
| `tut.grade` | First Strike | Unseen strikes earn more tells. Ghost, Shadow, or Exposed. |

## Shared world lines

### Thralls

Pick at random within each state. Every thrall line works in any circle.

| ID | State | Line |
| --- | --- | --- |
| `thrall.idle.1` | Unaware | Walk the line. Don't look at the master. |
| `thrall.idle.2` | Unaware | Another thousand years of this. |
| `thrall.idle.3` | Unaware | I had a name once. I think. |
| `thrall.sus.1` | Suspicious | Who's there? |
| `thrall.sus.2` | Suspicious | Something moved. |
| `thrall.sus.3` | Suspicious | I heard you. I think I heard you. |
| `thrall.alert.1` | Alert | Hunter! A hunter in the circle! |
| `thrall.alert.2` | Alert | Hooded one! Wake the master! |
| `thrall.lose.1` | Trail lost | Gone. Don't tell the master. |
| `thrall.lose.2` | Trail lost | Shadows playing tricks again. |
| `thrall.ember` | Investigating an ember | A spark? Down here? |

### Hunter

| ID | Trigger | Line |
| --- | --- | --- |
| `hunter.vantage` | Vantage synced (`vantage-sync`) | I see you now. All of you. |
| `hunter.leap` | Leap of faith | Down. |
| `hunter.takedown` | Takedown (optional, 1 in 3) | Sleep. |
| `hunter.marked` | Caught, respawn at checkpoint | They know I'm here. Doesn't matter. |
| `hunter.sight` | First Hunter's Sight in a circle | There. |

### Strike and grade

| ID | Trigger | Speaker | Line |
| --- | --- | --- | --- |
| `strike.prompt` | Prompt label | — | Strike |
| `strike.open` | Prompt label while the boss is Alert | — | Duel in the open |
| `strike.nocard` | Prompt label with no unlocked card | — | Practice strike (an echo) |
| `strike.nocard.line` | Practice strike chosen | PIT | No demon to bind. This is only an echo. Swear the Oath in the Pit. |
| `grade.ghost` | Grade label and blurb | — | Ghost: never seen. Two tells, and the guardian plays its habits. |
| `grade.shadow` | Grade label and blurb | — | Shadow: suspected, never caught. One tell. |
| `grade.exposed` | Grade label and blurb | — | Exposed: they saw you coming. No tells. The guardian fights wild. |

### Duel

| ID | Trigger | Speaker | Line |
| --- | --- | --- | --- |
| `duel.bind` | Choosing a stake | PIT | Bind a demon. If you lose, it stays down here. |
| `duel.seal` | Choosing a move | PIT | Seal your strike. Not even the guardian can see it. |
| `duel.wait` | Waiting for both seals | PIT | Both blades in the dark. Wait for the reveal. |
| `duel.crit` | Player crit | PIT | The Omen favors you. |
| `duel.crit.enemy` | Boss crit | PIT | The Omen turns its face. |
| `duel.tie` | VRF breaks a tie | PIT | Blade meets blade. The Omen decides. |
| `duel.proof` | Settlement link label | — | Proof of the kill, written on the Ledger |
| `echo.won` | Practice win | PIT | An echo of a kill. Nothing was bound. Nothing was taken. |
| `echo.lost` | Practice loss | PIT | Only an echo. Learn from it while it's free. |
| `fled` | Refund after the deadline | PIT | The guardian fled into the dark. Your demon comes back to you. Nothing else. |
| `lost.wake` | Hunter wakes at the circle entrance after a loss | PIT | You wake at the entrance. Your demon does not. The guardian still lives. |
| `resume` | An interrupted duel is found | PIT | Your blade is still drawn. Finish the duel you started. |

## The six circles

Every circle uses the same beats, so the world needs one template:

| Beat | Spec hook | Lines |
| --- | --- | --- |
| Enter | cutscene `circle-<n>-enter` | 2 lines: PIT, then HUNTER |
| Stalk | Boss ambient while Unaware, one every 12 to 20 s | 3 barks |
| Alerted | Boss becomes Alerted or the circle is Marked | 1 line |
| Intel | Pick up scroll 1, 2, 3 | Scroll text. Each holds one tell (see the bot profiles) |
| Strike | After Strike, before the arena shows | Guardian line, then hunter line, then `demon-duels:launch` |
| Finisher | `demon-duels:finisher` `{grade}` | 1 hunter line for the grade's finisher |
| Clear | cutscene `circle-<n>-clear`, after `finisher-done` | Victory line (from `campaign.js`), rune line |
| Lost | `settled` with `won: false`, before `lost.wake` | Guardian taunt, hunter reply |

### Circle 0: Ash Gate. Ash Warden, keeper of the first flame

**Codex:** The gate has burned for a thousand years. Its keeper feeds the fire with the names of those who turn back. Yours is still in there, crackling.

| ID | Speaker | Line |
| --- | --- | --- |
| `c0.enter.1` | PIT | The gate still burns with your name. Listen. You can hear it crack. |
| `c0.enter.2` | HUNTER | Then I'll walk in through the smoke. |
| `c0.stalk.1` | WARDEN | Keep those braziers lit! The dark is where the hunters hide. |
| `c0.stalk.2` | WARDEN | Turn back, little ember. Turning back is what I eat. |
| `c0.stalk.3` | WARDEN | I smell ash on the wind. Familiar ash. |
| `c0.alerted` | WARDEN | A hunter at my gate? Light every fire! |
| `c0.intel.1` | — | Gate log: "The Warden trusts its guard above all. It raises its Ward first." |
| `c0.intel.2` | — | Scorched note: "It hates curses. It almost never opens with Hex." |
| `c0.intel.3` | — | Last words of a hunter: "Rend. Rend breaks the guard. I saw it too late." |
| `c0.strike.1` | WARDEN | Leave your fear at the threshold. I have no use for ashes. |
| `c0.strike.2` | HUNTER | You took my name. I'm taking your card. |
| `c0.fin.ghost` | HUNTER | You never saw the blade. |
| `c0.fin.shadow` | HUNTER | Your fire's out. |
| `c0.fin.exposed` | HUNTER | Burn. |
| `c0.clear.1` | PIT | The first fire kneels. A path opens through the dark. |
| `c0.clear.2` | PIT | One rune returns. It is warm. It remembers you. |
| `c0.lost.1` | WARDEN | Your demon burns well. Bring me another. |
| `c0.lost.2` | HUNTER | The fire can keep it. Not my name. |

### Circle 1: Hollow Rift. Void Wraith, the voice between worlds

**Codex:** Beyond the gate the road ends in nothing. The Wraith cannot see. It hears, and it hears everything. It knows the move you wish you had made, but it cannot hear a sealed one.

| ID | Speaker | Line |
| --- | --- | --- |
| `c1.enter.1` | PIT | Past the gate, the road ends. Something here listens instead of looking. |
| `c1.enter.2` | HUNTER | Then I won't make a sound. |
| `c1.stalk.1` | WRAITH | We hear your heartbeat, hunter. All of us do. |
| `c1.stalk.2` | WRAITH | Step softly. Softer. Softer still. We are listening. |
| `c1.stalk.3` | WRAITH | The last hunter screamed here. You can still hear it. |
| `c1.alerted` | WRAITH | Loud, loud, loud. We know where you are now. |
| `c1.intel.1` | — | Torn page: "It whispers its curses. The Wraith reaches for Hex first." |
| `c1.intel.2` | — | Carved in the rift: "It has no claws worth the name. It rarely uses Rend." |
| `c1.intel.3` | — | Hunter's notes: "A Ward turns its curse back on it." |
| `c1.strike.1` | WRAITH | Even the bravest soul casts a shadow. Yours belongs to me. |
| `c1.strike.2` | HUNTER | Then listen for this one. It's sealed. |
| `c1.fin.ghost` | HUNTER | You didn't hear that one. |
| `c1.fin.shadow` | HUNTER | Quiet now. |
| `c1.fin.exposed` | HUNTER | Hear that? |
| `c1.clear.1` | PIT | The silence breaks. Something ancient has noticed your descent. |
| `c1.clear.2` | PIT | A second rune. It whispers the first sound of your name. |
| `c1.lost.1` | WRAITH | We guessed right. We always guess right. |
| `c1.lost.2` | HUNTER | That was the Omen, not you. |

### Circle 2: Bone Citadel. Marrow King, sovereign of the forgotten

**Codex:** Every fallen challenger is a stone in his palace, and the floors still crack under careless feet. The King keeps a court of the damned and offers every hunter a seat in it. None has sat down.

| ID | Speaker | Line |
| --- | --- | --- |
| `c2.enter.1` | PIT | A palace built of challengers. Mind where you step. The floors talk. |
| `c2.enter.2` | HUNTER | Then I'll walk above them. |
| `c2.stalk.1` | KING | My court! Bow lower. Someone in this crowd is not bowing. |
| `c2.stalk.2` | KING | Every bone in this floor was brave once. Listen to them crack. |
| `c2.stalk.3` | KING | All roads lead here. Every bone ends up mine. |
| `c2.alerted` | KING | An uninvited guest! Seat them. Permanently. |
| `c2.intel.1` | — | Court decree: "The King strikes first and strikes hard. He loves Rend." |
| `c2.intel.2` | — | Jester's scrawl: "His Majesty never hides behind a shield. Rarely Ward." |
| `c2.intel.3` | — | Under the throne: "A Hex brings the brute to his knees." |
| `c2.strike.1` | KING | All roads lead to my throne. Few lead away. |
| `c2.strike.2` | HUNTER | I'm not here for the throne. Just the crown. |
| `c2.fin.ghost` | HUNTER | Long live nobody. |
| `c2.fin.shadow` | HUNTER | Court's dismissed. |
| `c2.fin.exposed` | HUNTER | Kneel. |
| `c2.clear.1` | PIT | The crown falls. The dead make way for the living. |
| `c2.clear.2` | PIT | A third rune. Half a name is still a name. |
| `c2.lost.1` | KING | A fine demon for my collection. Thank you, subject. |
| `c2.lost.2` | HUNTER | Keep it polished. I'll be back for it. |

### Circle 3: Drowned Mire. Mire Phantom, hunger beneath the surface

**Codex:** The swamp remembers every promise ever broken, and the Phantom lies under its still water collecting them. The fog comes and goes like breath. Under the water, nothing can see you, not even it.

| ID | Speaker | Line |
| --- | --- | --- |
| `c3.enter.1` | PIT | The mire keeps every broken promise. It is very, very deep. |
| `c3.enter.2` | HUNTER | Good. I can hold my breath. |
| `c3.stalk.1` | PHANTOM | Come closer. I only want to see your face. |
| `c3.stalk.2` | PHANTOM | You promised someone you'd come home. I can taste it. |
| `c3.stalk.3` | PHANTOM | Here comes the fog. Hold still. Let it hold you. |
| `c3.alerted` | PHANTOM | Gotcha. The water is mine, and so are you. |
| `c3.intel.1` | — | Waterlogged page: "It drags you down with curses. Hex, nearly always." |
| `c3.intel.2` | — | Scratched on a reed post: "It won't claw. Rend is not in its nature." |
| `c3.intel.3` | — | Drowned hunter's charm: "Ward against it. Its curses come back to it." |
| `c3.strike.1` | PHANTOM | Step closer. The water is only as deep as your regret. |
| `c3.strike.2` | HUNTER | Then it's shallow. |
| `c3.fin.ghost` | HUNTER | Stay down. |
| `c3.fin.shadow` | HUNTER | Back in the water. |
| `c3.fin.exposed` | HUNTER | Drown. |
| `c3.clear.1` | PIT | The waters clear. Your reflection is no longer alone. |
| `c3.clear.2` | PIT | A fourth rune. In the water, you almost see your face. |
| `c3.lost.1` | PHANTOM | One more promise for the mire. |
| `c3.lost.2` | HUNTER | Not a promise. A debt. |

### Circle 4: Rime Spire. Frost Herald, harbinger of the last winter

**Codex:** No bell has rung here since the world was young. The Herald keeps a winter so cold that time has stopped. Snow remembers every step, and the ice forgives none. Only the stone paths keep their silence.

| ID | Speaker | Line |
| --- | --- | --- |
| `c4.enter.1` | PIT | Here, time froze. Even your footprints wait to be followed. |
| `c4.enter.2` | HUNTER | Then I'll stay on the stone. |
| `c4.stalk.1` | HERALD | Be still. Nothing has moved here in an age. |
| `c4.stalk.2` | HERALD | Footprints. In my snow. Follow them. |
| `c4.stalk.3` | HERALD | The bell is silent. It will ring for you. |
| `c4.alerted` | HERALD | Stop. Forever. |
| `c4.intel.1` | — | Frozen hymn: "The Herald waits. It keeps its Ward up." |
| `c4.intel.2` | — | Cracked bell plate: "Curses melt in its cold. It rarely casts Hex." |
| `c4.intel.3` | — | Frostbitten hunter: "Rend shatters the guard. Be the one who moves." |
| `c4.strike.1` | HERALD | Be still. Eternity will not hurt for long. |
| `c4.strike.2` | HUNTER | Your winter ends tonight. |
| `c4.fin.ghost` | HUNTER | Ring your bell. |
| `c4.fin.shadow` | HUNTER | Thaw. |
| `c4.fin.exposed` | HUNTER | Shatter. |
| `c4.clear.1` | PIT | The bell rings once. The last seal begins to fracture. |
| `c4.clear.2` | PIT | A fifth rune. Your name is one breath from whole. |
| `c4.lost.1` | HERALD | Still. Good. Stay that way. |
| `c4.lost.2` | HUNTER | Ice cracks. So will you. |

### Circle 5: Gloam Throne. Gloam Shade, the shadow behind the crown

**Codex:** At the bottom of the world, the final guardian wears no crown. It needs none: every shadow answers to it, and it sees best in the dark. It was the first hunter of the Sealed Hand. It chained the Pit so the Old Pact would answer to no one else.

| ID | Speaker | Line |
| --- | --- | --- |
| `c5.enter.1` | PIT | The last rune, and the one who hid it. Here, the dark is its eyes. |
| `c5.enter.2` | HUNTER | Then I'll hunt in the light. |
| `c5.stalk.1` | SHADE | Hood up. Blade hidden. Breathing slow. I taught that. |
| `c5.stalk.2` | SHADE | Every shadow here is mine. Stay in them. Please. |
| `c5.stalk.3` | SHADE | You walk like me. You hide like me. You'll lose like me. |
| `c5.alerted` | SHADE | Sloppy. I was never sloppy. |
| `c5.intel.1` | — | Sealed Hand codex: "The founder always struck first. Rend was its way." |
| `c5.intel.2` | — | Torn oath: "It never trusted a guard. It rarely raises Ward." |
| `c5.intel.3` | — | Margin note in your own hand: "Hex. Curse the blade before it lands." |
| `c5.strike.1` | SHADE | You came here for power. Show me what you are willing to lose. |
| `c5.strike.2` | HUNTER | Everything I bound. That's the Pact. You forgot it. |
| `c5.fin.ghost` | HUNTER | The Sealed Hand never shows the strike. You taught me. |
| `c5.fin.shadow` | HUNTER | Your lesson. My blade. |
| `c5.fin.exposed` | HUNTER | Look at me. |
| `c5.clear.1` | PIT | Six guardians fall. The Underworld knows your name. The open pit awaits. |
| `c5.lost.1` | SHADE | Close. Everyone gets close. |
| `c5.lost.2` | HUNTER | Close is a start. |

Circle 5 has no rune line. Its `circle-5-clear` plays `c5.clear.1` and goes straight into the `outro`.

## Boss bot profiles (for the duel module)

The spec requires every tell to be true of the house bot's move weighting. The bot currently seals a uniformly random move. These profiles make the scroll tells true and are the default I recommend. The duel module owns the final numbers, and if it changes them, the scroll text above must change with them.

| Boss | Favors | Avoids | Ghost (predictable) | Shadow (normal) | Exposed (random) |
| --- | --- | --- | --- | --- | --- |
| 0 Ash Warden | Ward | Hex | Ward 60, Rend 30, Hex 10 | Ward 45, Rend 35, Hex 20 | uniform |
| 1 Void Wraith | Hex | Rend | Hex 60, Ward 30, Rend 10 | Hex 45, Ward 35, Rend 20 | uniform |
| 2 Marrow King | Rend | Ward | Rend 60, Hex 30, Ward 10 | Rend 45, Hex 35, Ward 20 | uniform |
| 3 Mire Phantom | Hex | Rend | Hex 60, Ward 30, Rend 10 | Hex 45, Ward 35, Rend 20 | uniform |
| 4 Frost Herald | Ward | Hex | Ward 60, Rend 30, Hex 10 | Ward 45, Rend 35, Hex 20 | uniform |
| 5 Gloam Shade | Rend | Ward | Rend 60, Hex 30, Ward 10 | Rend 45, Hex 35, Ward 20 | uniform |

- **What the scrolls say.** In each circle, scroll 1 names the favored move, scroll 2 the avoided move, and scroll 3 the counter to the favored move. Under the Ghost and Shadow profiles all three are true. Under Exposed (uniform) the bot has no habits, so the duel should show no tells, which matches the spec's 0 tells for Exposed.
- **Which tells show.** The spec gives Ghost 2 tells and Shadow 1. I suggest the grade reveals the first tells in scroll order that the player has not already found. Collected scrolls show on top of those.
- **Why these pairs.** Each boss avoids the one move that beats its counter. A player who follows scroll 3 wins outright 60% of the time and loses only 10% under Ghost (45% and 20% under Shadow), before the Omen's crits. A judge sees the intel pay off in a single duel.

## Cutscene `outro`: the bounty board opens (about 40 seconds)

Plays once, after `circle-5-clear`. It ends on the bounty board.

`{name}` is the player's short wallet key (for example `7xKp…3fQ2`). It is the one name in the Underworld no fire can burn, because the Ledger holds it.

| ID | Shot | Speaker | Line |
| --- | --- | --- | --- |
| `outro.01` | The Gloam Shade's card falls into the hunter's hand. Its shadow peels away from the hunter's. | SHADE | So you know. The Pit was never mine. I only kept it chained. |
| `outro.02` | Six runes rise from six cards and circle the hunter. | PIT | Six runes. One name. |
| `outro.03` | The runes burn letters into the dark, then resolve into `{name}`. | PIT | {name}. Written where no fire can reach it. |
| `outro.04` | The hunter lowers the hood for the first time. | HUNTER | I remember. |
| `outro.05` | Back in the Pit. The six chains on the bounty board snap one by one. | PIT | The chains are broken. The board is open. Not just to you. |
| `outro.06` | Hooded hunters fill the Pit and pin demon cards to the board. | PIT | Hunters from every circle. Each with a demon bound and a blade sealed. |
| `outro.07` | Close on the board: staked cards waiting for an answer. | PIT | No guardians now. No house. Only the Old Pact. The winner takes both. |
| `outro.08` | The hunter raises the hood and walks to the board. | HUNTER | Then let's see who's hungry. |
| `outro.09` | Title card: THE OPEN PIT. Fade into the bounty board. | PIT | Welcome to the Pit, {name}. It always takes. |

## Bounty board and hunter ledger copy

| ID | Where | Text |
| --- | --- | --- |
| `board.title` | Board header | The Bounty Board |
| `board.sub` | Under the header | Every bounty is a demon on the table. Answer it with yours. The winner takes both. |
| `board.row` | One open duel | {kind} staked by hunter {owner} |
| `board.challenge` | Button: `join_duel` with a chosen card | Challenge |
| `board.post` | Button: `open_duel` with a chosen card | Post a bounty |
| `board.posted` | After posting | Your demon is on the board. Wait for a challenger, or take it back. |
| `board.cancel` | Button on your own open bounty | Take back your demon |
| `board.empty` | No open duels | The board is empty. Post the first bounty. |
| `board.friend` | Door button | Challenge a friend |
| `board.note` | Footer | Bounties are devnet duels. Nothing here is bought or sold, only won. |
| `ledger.title` | Ledger header | The Hunter Ledger |
| `ledger.row` | One `DuelSettled` log | Hunter {winner} slew the {kind} ({grade}) |
| `ledger.row.pvp` | A PvP settlement | Hunter {winner} took {loser}'s {kind} |
| `ledger.note` | Under the ledger | Kills come from the chain. Grades are local and unverified. |

If the board cannot show a grade, drop ` ({grade})` from `ledger.row`. A PvP duel never shows a grade.

## Lore codex: world entries

Unlock each entry at the listed moment. They sit next to the six boss codex entries above.

| ID | Title | Unlocks | Text |
| --- | --- | --- | --- |
| `lore.underworld` | The Underworld | `intro` ends | It does not give. It takes. Every soul that falls keeps only its name, and the Underworld spends eternity trying to take that too. |
| `lore.hand` | The Sealed Hand | `intro` ends | Demon hunters with one rule: never show the strike until it lands. A sealed move stays hidden from both fighters until each has committed. Then both are revealed at once. |
| `lore.oath` | The Hunter's Oath | Pack opened | Every hunter starts with three demons chosen by the dark. Nobody can rig the choice. Not even the guardians. |
| `lore.pact` | The Old Pact | First duel | Older than the guardians: bind a demon to fight, and the winner takes both. It is the only law down here that has never been broken. |
| `lore.omen` | The Omen | First crit or tie | A wheel that turns somewhere beneath the Pit. It decides which strikes bite deeper and who wins when blade meets blade. It answers to no one. |
| `lore.ledger` | The Ledger | First chain win | Every kill is written where no fire can reach and no guardian can erase. Your demons are yours because the Ledger says so. |
| `lore.runes` | The Six Runes | Circle 0 cleared | The Ash Warden burned your name, and it broke into six runes, one for each guardian. Win them back and you can be named again. |
| `lore.thralls` | Thralls | First takedown | Souls who lost their names and kept walking. They serve the guardians because they forgot what else to do. |
| `lore.guardians` | The Guardians | Circle 2 cleared | Six demons who keep the Pit chained and the souls in their cards. They called it order. It was a monopoly. |
| `lore.first` | The First Hunter | Circle 4 cleared | The Sealed Hand had a founder. The order's records stop the year the Pit was chained. |
| `lore.pit` | The Open Pit | `outro` ends | With the chains broken, any hunter can bind a demon and challenge any other. No guardians, no house. Only hunters and the Pact. |

## Integration notes

- **Cutscene ids.** The story module answers `demon-duels:cutscene` `{id}` for `intro`, `circle-<n>-enter`, `circle-<n>-clear` and `outro`, and sends `demon-duels:cutscene-done` `{id}` when it ends or is skipped.
- **Progress.** `circle-<n>-clear`, the rune line and the codex unlocks follow the accepted campaign journal write (via `finisher-done`), never a raw event. Practice, PvP, refunds and spectating play `echo.*`, `fled` or nothing, and unlock nothing.
- **Strike timing.** Show `c<n>.strike.1` and `.2` as barks while the arena loads, and do not hold the launch for them. The spec switches surfaces only after the arena shows.
- **Finisher lines.** The finisher module or the world plays `c<n>.fin.<grade>` over the finisher animation.
- **Codex storage.** Unlocked lore is flavor. Store it in `demon-duels:world:v1:<player>` (for example `lore: [ids]`) or derive it from the journal and intel. It grants nothing.
- **Circle ids.** `c0` to `c5` are demon ids 0 Ash Warden, 1 Void Wraith, 2 Marrow King, 3 Mire Phantom, 4 Frost Herald, 5 Gloam Shade.
- **Cut line.** If circles 2 to 5 ship as data-only, their stalk lines that mention a signature mechanic still read fine without it (crowds, cracking floors, fog, footprints, inverted light).
- **No new promises.** Nothing in this script promises tokens, prices or selling. The board is open duels only, which the spec calls an ante market.
