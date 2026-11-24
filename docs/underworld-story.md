# Demon Duels: The Unnamed Hunter

The story and cutscene script for the Underworld world. It fits a hackathon demo: the opening runs about 45 seconds, each circle about 30 seconds of lines around its duel, and the ending about 40 seconds. Every spoken line is subtitle-ready (90 characters or fewer) and has a stable ID that the world engine and cutscene player can key on.

Realm names, epithets, boss quotes and victory lines match `web/src/campaign.js` from the story campaign (PR #3), so the walkable world and the fallback map tell the same story.

## Cast

| Speaker | Who | Voice direction |
| --- | --- | --- |
| `PIT` | The narrator. The Underworld's hunger, older than the guardians. It is the open pit. | Low, patient, amused. Never shouts. |
| `HUNTER` | The player. A hooded hunter of the Sealed Hand whose name was burned. | Few words, dry, cold. |
| `WARDEN` | Ash Warden, guardian of circle I | Crackling, proud, a jailer. |
| `WRAITH` | Void Wraith, guardian of circle II | Whispered, overlapping, mocking. |
| `KING` | Marrow King, guardian of circle III | Grand, courtly, rattling. |
| `PHANTOM` | Mire Phantom, guardian of circle IV | Wet, sweet, coaxing. |
| `HERALD` | Frost Herald, guardian of circle V | Slow, calm, final. |
| `SHADE` | Gloam Shade, guardian of circle VI | The hunter's own voice, distorted. |

## Logline

You are a hooded hunter whose name was burned at the gates of the Underworld. Six demon guardians each hold what was taken from you. Stalk each one unseen, strike with a blade no one sees until it lands, and take its card. Break all six seals and the open pit belongs to every hunter.

## The hunter: backstory and motive

- **The Sealed Hand.** An order of hunters that fought demons with one rule: never show your strike until it lands. Their blade is a move sealed in the dark and revealed at the moment both fighters commit.
- **The burning.** The hunter came down to the Cinder Gate to free the souls bound inside the guardians' cards. The Ash Warden caught them, burned their name into the gate fire, and threw them back into the dark. A soul with no name cannot leave the Underworld.
- **What was left.** The hunter woke at the gate with a hood, the Sealed Hand's blade, and three demons the dark chose for them: the starter pack.
- **The motive.** The burned name split into six embers, one held by each guardian. Win a guardian's card and its ember comes back. Recover all six and the hunter can be named, and whoever is named can open the pit.
- **The twist.** The Gloam Shade, the last guardian, was the first hunter of the Sealed Hand. It closed the pit so that the Old Pact would answer only to it, and it wears the hunter's face because it hunted the same way. Beating it does not make the hunter the new ruler. It breaks the last seal, and the pit opens to everyone.

## The rules in the story's words

Use these terms in UI copy so the fiction explains what the chain does. Each one is accurate to the current program.

| Story term | What actually happens |
| --- | --- |
| **The Three** | The free starter pack: MagicBlock VRF picks three distinct demon cards. |
| **Binding** a demon | Staking a card. It is locked to one duel and cannot be used elsewhere. |
| **The hidden blade** / **sealing** a move | Choosing Rend, Ward or Hex. The pick is private inside MagicBlock's TEE until both fighters have sealed, then both are revealed together. |
| **Rend, Ward, Hex** | Rend claws through Ward, Ward reflects Hex, Hex curses Rend. 2 damage, +1 for advantage. |
| **The Omen** | VRF decides 25% crits (+2 damage) and breaks ties. |
| **The Old Pact** | Winner takes both cards. Card ownership changes onchain at settlement. |
| **The Unbinding** | If a duel has not settled 30 minutes after both cards are staked, either player can reclaim their stake. |
| **The Ledger** | Solana devnet. The settlement transaction is the proof of a kill. |
| **An echo** | A practice duel. Nothing is staked or claimed. |
| **The open pit** | Player-vs-player duels after all six seals break. |

## Opening cutscene (about 45 seconds)

Plays once before the first map load and can be skipped at any time (`Skip` key: Esc or tap). Ends on the starter pack.

| ID | Shot | Speaker | Line |
| --- | --- | --- | --- |
| `open.01` | Black. A single ember drifts down. | PIT | Every soul that falls here keeps one thing. Its name. |
| `open.02` | The Cinder Gate, burning. A hooded figure kneels before the Ash Warden. | PIT | Except you. |
| `open.03` | The Warden's hand closes. Letters of fire peel off the hunter's hood into the gate. | WARDEN | No name, no way out. The fire thanks you. |
| `open.04` | The hunter is thrown into the dark. Six embers scatter toward six distant lights. | PIT | Your name broke into six embers. Six guardians caught them. |
| `open.05` | Quick cuts: a shadow in a void, a bone throne, a black fen, a frozen bell, an eclipse. | PIT | They keep the pit sealed. They keep the souls in their cards. |
| `open.06` | The hunter wakes at the gate. Hood up. A blade slides out of the sleeve, then back. | HUNTER | Then I take them back. One at a time. |
| `open.07` | Close on the hidden blade. | PIT | The Sealed Hand. They never showed a strike until it landed. |
| `open.08` | Three cards rise out of the ash, face down, and turn. | PIT | The dark has chosen three demons for you. Bind one. Hunt. |

**Handoff:** after `open.08`, show the starter pack flow (`Open your three`). If the player already owns cards, skip `open.08` and cut straight to circle I.

**First-time hints** (shown once, as small text over the world, not voiced):

- `hint.sneak` Stay in the dark. Guardians' eyes are lanterns.
- `hint.strike` Reach the guardian unseen and press Strike to start the duel.
- `hint.seal` Seal your move. Not even the guardian sees it until both blades are drawn.
- `hint.pact` The Old Pact: the winner takes both cards. Bind a demon you can afford to lose.

## Per-circle script

Every circle uses the same six beats, so the engine needs only one template.

| Beat | Trigger | Lines |
| --- | --- | --- |
| `intro` | Player enters the circle | 2 lines, PIT then HUNTER |
| `stalk` | Ambient while sneaking; pick one at random every 12 to 20 s | 3 barks from the guardian |
| `seen` | Player is spotted (optional; only if the engine has detection) | 1 line, then reset to the last checkpoint |
| `face` | Player reaches the guardian and presses Strike | Guardian, then hunter. Then dispatch `demon-duels:launch` |
| `won` | `demon-duels:settled` with `mode: 'chain'`, `won: true` and the matching `opponentKind` | Finisher line, then the campaign victory line, then the ember line |
| `lost` | `demon-duels:settled` with `mode: 'chain'`, `won: false` | Guardian taunt, then hunter |

Practice duels (`mode: 'practice'`) never play `won`. They play `echo.won` or `echo.lost` from the shared lines below.

### Circle I: The Cinder Gate. Ash Warden, keeper of the first flame

**Codex:** The gate has burned for a thousand years. Its keeper feeds the fire with the names of those who turn back. Yours is still in there, crackling.

| ID | Speaker | Line |
| --- | --- | --- |
| `c0.intro.1` | PIT | The gate still burns with your name. Listen. You can hear it crack. |
| `c0.intro.2` | HUNTER | Then I'll walk in through the smoke. |
| `c0.stalk.1` | WARDEN | Another soul at my gate? The fire is always hungry. |
| `c0.stalk.2` | WARDEN | Turn back, little ember. Turning back is what I eat. |
| `c0.stalk.3` | WARDEN | I smell ash on the wind. Familiar ash. |
| `c0.seen` | WARDEN | There you are. Back into the dark. |
| `c0.face.1` | WARDEN | Leave your fear at the threshold. I have no use for ashes. |
| `c0.face.2` | HUNTER | You took my name. I'm taking your card. |
| `c0.won.1` | HUNTER | You never saw the blade. |
| `c0.won.2` | PIT | The first fire kneels. A path opens through the dark. |
| `c0.won.3` | PIT | One ember returns. It is warm. It remembers you. |
| `c0.lost.1` | WARDEN | Your demon burns well. Bring me another. |
| `c0.lost.2` | HUNTER | The fire can keep it. Not my name. |

### Circle II: The Hollow Expanse. Void Wraith, the voice between worlds

**Codex:** Beyond the gate the road ends in nothing. The Wraith lives in the gap between a choice and its consequence, and it knows the move you wish you had made. It cannot see a sealed one.

| ID | Speaker | Line |
| --- | --- | --- |
| `c1.intro.1` | PIT | Past the gate, the road ends. Something moves inside the silence. |
| `c1.intro.2` | HUNTER | Good. Silence is where I work. |
| `c1.stalk.1` | WRAITH | We hear your heartbeat, hunter. All of us do. |
| `c1.stalk.2` | WRAITH | Rend? Ward? Hex? Tell us. We always guess. |
| `c1.stalk.3` | WRAITH | The last hunter screamed here. You can still hear it. |
| `c1.seen` | WRAITH | Found you. Again, again, again. |
| `c1.face.1` | WRAITH | Even the bravest soul casts a shadow. Yours belongs to me. |
| `c1.face.2` | HUNTER | Then read this move. It's sealed. |
| `c1.won.1` | HUNTER | Guess again. |
| `c1.won.2` | PIT | The silence breaks. Something ancient has noticed your descent. |
| `c1.won.3` | PIT | A second ember. It whispers the first sound of your name. |
| `c1.lost.1` | WRAITH | We guessed right. We always guess right. |
| `c1.lost.2` | HUNTER | You got lucky. The Omen doesn't love you. |

### Circle III: The Ossuary Throne. Marrow King, sovereign of the forgotten

**Codex:** Every fallen challenger is a stone in his palace. The King collects demons the way he collects bones, and he has never refused a wager. He offers every hunter a seat at court. None has sat down.

| ID | Speaker | Line |
| --- | --- | --- |
| `c2.intro.1` | PIT | A palace built of challengers. Mind where you step. They were brave too. |
| `c2.intro.2` | HUNTER | I'm not here to be brave. |
| `c2.stalk.1` | KING | My court grows quiet. Someone uninvited walks the halls. |
| `c2.stalk.2` | KING | Guards! Oh. Yes. I made them all into furniture. |
| `c2.stalk.3` | KING | Every road leads here. Every bone ends up mine. |
| `c2.seen` | KING | A guest! Seat them. Permanently. |
| `c2.face.1` | KING | All roads lead to my throne. Few lead away. |
| `c2.face.2` | HUNTER | I'm not here for the throne. Just the crown. |
| `c2.won.1` | HUNTER | Long live nobody. |
| `c2.won.2` | PIT | The crown falls. The dead make way for the living. |
| `c2.won.3` | PIT | A third ember. Half a name is still a name. |
| `c2.lost.1` | KING | A fine demon for my collection. Thank you, subject. |
| `c2.lost.2` | HUNTER | Keep it polished. I'll be back for it. |

### Circle IV: The Weeping Fen. Mire Phantom, hunger beneath the surface

**Codex:** The swamp remembers every promise ever broken. The Phantom lies under still water and collects them. It cannot drag down a hunter who makes no promises, only moves.

| ID | Speaker | Line |
| --- | --- | --- |
| `c3.intro.1` | PIT | The fen keeps every broken promise. It is very, very deep. |
| `c3.intro.2` | HUNTER | I don't make promises. |
| `c3.stalk.1` | PHANTOM | Come closer. I only want to see your face. |
| `c3.stalk.2` | PHANTOM | You promised someone you'd come home. I can taste it. |
| `c3.stalk.3` | PHANTOM | The water is warm tonight. Wade in. |
| `c3.seen` | PHANTOM | Gotcha. Down you go. |
| `c3.face.1` | PHANTOM | Step closer. The water is only as deep as your regret. |
| `c3.face.2` | HUNTER | Then it's shallow. |
| `c3.won.1` | HUNTER | Stay down. |
| `c3.won.2` | PIT | The waters clear. Your reflection is no longer alone. |
| `c3.won.3` | PIT | A fourth ember. In the water, you almost see your face. |
| `c3.lost.1` | PHANTOM | One more promise for the fen. |
| `c3.lost.2` | HUNTER | Not a promise. A debt. |

### Circle V: The Still Cathedral. Frost Herald, harbinger of the last winter

**Codex:** No bell has rung here since the world was young. The Herald keeps a winter so cold that time has stopped, and in stopped time every duel ends in a stalemate. The Omen still turns here. It is the only thing that does.

| ID | Speaker | Line |
| --- | --- | --- |
| `c4.intro.1` | PIT | Here, time froze. Even your breath hangs in the air like a confession. |
| `c4.intro.2` | HUNTER | Then I'll move between the seconds. |
| `c4.stalk.1` | HERALD | Be still. Nothing has moved here in an age. |
| `c4.stalk.2` | HERALD | Footsteps. In my cathedral. How rude. |
| `c4.stalk.3` | HERALD | The bell is silent. It will ring for you. |
| `c4.seen` | HERALD | Stop. Forever. |
| `c4.face.1` | HERALD | Be still. Eternity will not hurt for long. |
| `c4.face.2` | HUNTER | Your winter ends tonight. |
| `c4.won.1` | HUNTER | Ring your bell. |
| `c4.won.2` | PIT | The bell rings once. The last seal begins to fracture. |
| `c4.won.3` | PIT | A fifth ember. Your name is one breath from whole. |
| `c4.lost.1` | HERALD | Still. Good. Stay that way. |
| `c4.lost.2` | HUNTER | Ice cracks. So will you. |

### Circle VI: The Eclipse Sanctum. Gloam Shade, the shadow behind the crown

**Codex:** At the bottom of the world, the final guardian wears no crown. It needs none: every shadow in the Underworld answers to it. It was the first hunter of the Sealed Hand. It closed the pit so the Old Pact would answer to no one else.

| ID | Speaker | Line |
| --- | --- | --- |
| `c5.intro.1` | PIT | The bottom of the world. The last ember is here, and so is the one who hid it. |
| `c5.intro.2` | HUNTER | Then this is where it ends. |
| `c5.stalk.1` | SHADE | Hood up. Blade hidden. Breathing slow. I taught that. |
| `c5.stalk.2` | SHADE | You walk like me. You hide like me. You'll lose like me. |
| `c5.stalk.3` | SHADE | Every shadow here is mine. Including yours. |
| `c5.seen` | SHADE | Sloppy. I was never sloppy. |
| `c5.face.1` | SHADE | You came here for power. Show me what you are willing to lose. |
| `c5.face.2` | HUNTER | Everything I bound. That's the Pact. You forgot it. |
| `c5.won.1` | HUNTER | The Sealed Hand never shows the strike. You taught me. |
| `c5.won.2` | PIT | Six guardians fall. The Underworld knows your name. The open pit awaits. |
| `c5.lost.1` | SHADE | Close. Everyone gets close. |
| `c5.lost.2` | HUNTER | Close is a start. |

After `c5.won.2`, the last ember returns in the ending cutscene, so circle VI has no `won.3`.

## Ending cutscene: the open pit (about 40 seconds)

Plays once, after the first chain win over the Gloam Shade with all six seals broken. It ends on the open pit's challenge board, the player-vs-player lobby: open challenges posted by other hunters, each with a staked demon.

`{name}` is the player's short wallet address (for example `7xKp…3fQ2`). Their name is the one thing in the Underworld the fire cannot burn, because it is written on the Ledger.

| ID | Shot | Speaker | Line |
| --- | --- | --- | --- |
| `end.01` | The Gloam Shade's card falls into the hunter's hand. Its shadow peels away from the hunter's. | SHADE | So you know. The pit was never mine. I only kept it shut. |
| `end.02` | Six embers rise from six cards and circle the hunter. | PIT | Six embers. One name. |
| `end.03` | The embers burn letters into the dark, then resolve into `{name}`. | PIT | {name}. Written where no fire can reach it. |
| `end.04` | The hunter lowers the hood for the first time. | HUNTER | I remember. |
| `end.05` | The floor of the sanctum cracks open. Red light below. Distant crowd noise. | PIT | The seals are broken. The pit is open. Not just to you. |
| `end.06` | Down in the pit: banners, cages, lanterns. Hooded hunters post demon cards on a wall of stakes. | PIT | Hunters from every circle. Each one with a demon bound and a blade sealed. |
| `end.07` | Close on the wall: challenge cards waiting for an answer. | PIT | No guardians now. No mercy. Only the Old Pact. The winner takes both. |
| `end.08` | The hunter raises the hood again and steps down. | HUNTER | Then let's see who's hungry. |
| `end.09` | Title card: THE OPEN PIT. Fade into the challenge board. | PIT | Welcome to the pit, {name}. It always takes. |

**Handoff:** after `end.09`, open the PvP view with two calls to action: `Post a challenge` (bind a demon and wait for a rival) and `Answer a challenge` (accept an open one). On later visits, skip the cutscene and go straight to the board.

## Shared lines

| ID | Trigger | Speaker | Line |
| --- | --- | --- | --- |
| `echo.won` | Practice win | PIT | An echo of a kill. Nothing was bound. Nothing was taken. |
| `echo.lost` | Practice loss | PIT | Only an echo. Learn from it while it's free. |
| `bind.prompt` | Choosing a stake | PIT | Bind a demon. If you lose, it stays down here. |
| `seal.prompt` | Choosing a move | PIT | Seal your strike. Not even the guardian can see it. |
| `seal.wait` | Waiting for both seals | PIT | Both blades in the dark. Wait for the reveal. |
| `omen.crit` | Crit lands | PIT | The Omen favors you. |
| `omen.crit.enemy` | Enemy crit lands | PIT | The Omen turns its face. |
| `omen.tie` | VRF breaks a tie | PIT | Blade meets blade. The Omen decides. |
| `ledger.proof` | Link to the settlement transaction | — | Proof of the kill, written on the Ledger. |
| `unbind.prompt` | Duel unsettled after 30 minutes | PIT | The duel went cold. Unbind your demon and walk away. |
| `nocards` | Player has no cards left | PIT | Your vault is empty. The Pact took everything. Begin again as a new hunter. |
| `return.map` | Back to the map after any duel | PIT | The descent waits. |

A wallet can open only one starter pack (its pack account is derived from the wallet), so `nocards` points to the existing vault or a new guest, never a second pack.

## Lore codex: world entries

Unlock each entry at the listed moment. One to three sentences each, so they read in seconds.

| ID | Title | Unlocks | Text |
| --- | --- | --- | --- |
| `lore.underworld` | The Underworld | Opening ends | It does not give. It takes. Every soul that falls keeps only its name, and the Underworld spends its whole existence trying to take that too. |
| `lore.hand` | The Sealed Hand | Opening ends | An order of demon hunters with one rule: never show the strike until it lands. A sealed move is invisible to both fighters until each has committed. Then both are revealed at once. |
| `lore.three` | The Three | Starter pack opens | Every hunter starts with three demons chosen by the dark, not by them. Nobody can rig the choice. Not even the guardians. |
| `lore.pact` | The Old Pact | First duel | Older than the guardians: bind a demon to fight, and the winner takes both. Down here, the Pact is the only law that has never been broken. |
| `lore.omen` | The Omen | First crit or tie | A wheel that turns somewhere beneath the pit. It decides which strikes bite deeper and who wins when blades meet blades. It answers to no one. |
| `lore.ledger` | The Ledger | First chain win | Every kill is written somewhere no fire can reach and no guardian can erase. Your demons are yours because the Ledger says so. |
| `lore.embers` | The Six Embers | Circle I won | The Ash Warden burned your name. It broke into six embers, one for each guardian. Win them back and you can be named again. |
| `lore.guardians` | The Guardians | Circle III won | Six demons who keep the pit shut and the souls in their cards. They called it order. It was a monopoly. |
| `lore.first` | The First Hunter | Circle V won | The Sealed Hand had a founder. The order's records stop the year the pit closed. |
| `lore.pit` | The Open Pit | Ending | With the seals broken, any hunter can bind a demon and challenge any other. No guardians, no house. Only hunters and the Pact. |

## Integration notes for the other pieces

- **Progress only from settlement.** Play `won` lines, return embers and unlock lore only on `demon-duels:settled` with `mode: 'chain'`, `won: true` and `opponentKind` equal to the circle's demon id. A practice win plays `echo.won` and changes nothing.
- **Strike starts the duel.** After `face.2` finishes (or immediately if the player skips it), dispatch `demon-duels:launch` with `{opponentKind: <circle id>, mode: 'chain', returnToMap: true}`.
- **Finishers.** `won.1` is the line for the assassination finisher; it can play over the finisher animation. `won.2` and `won.3` follow once it ends.
- **Circle ids.** `c0` to `c5` map to demon ids 0 Ash Warden, 1 Void Wraith, 2 Marrow King, 3 Mire Phantom, 4 Frost Herald, 5 Gloam Shade.
- **Skipping.** Every cutscene line and boss line can be skipped. A demo run with skips takes under a minute of reading in total.
- **Audio.** No voice acting is assumed. Lines show as subtitles with a speaker tag. Each speaker can use a short sound from the CC0 pack as a voice sting.
- **The challenge board.** `open_duel` lets any other wallet `join_duel` while the duel is open, so the board can list open duels from other players. Listing them (for example with `getProgramAccounts` on duel accounts in the open phase) is the PvP view's job, not the script's.
- **No new promises.** Nothing in this script promises tokens, prices or real money. The open pit is the existing friend duel with open challenges, presented as a board.
