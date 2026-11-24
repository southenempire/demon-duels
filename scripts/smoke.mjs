import { chmod, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { ArenaClient, explorer, packKey, pickKey, proof, readDuel, readRound, readCard, until } from '../web/src/chain.js';

const base = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com', 'confirmed');
const stateDir = join(homedir(), '.config', 'demon-duels');
const load = async (file, create = false) => {
  const path = join(stateDir, file + '.json');
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(path, 'utf8'))));
  } catch (error) {
    if (!create || error.code !== 'ENOENT') throw error;
    const key = Keypair.generate();
    await writeFile(path, JSON.stringify([...key.secretKey]), { mode: 0o600, flag: 'wx' });
    await chmod(path, 0o600);
    return key;
  }
};

const sponsor = new ArenaClient(await load('deployer'), base);
const run = process.env.SMOKE_PROFILE || 'default';
assert.match(run, /^[a-zA-Z0-9_-]+$/, 'SMOKE_PROFILE must be a simple name');
const suffix = run === 'default' ? '' : '-' + run;
const player = new ArenaClient(await load('smoke-player' + suffix, true), base);
const bot = new ArenaClient(await load('smoke-bot' + suffix, true), base);
const metric = (label, value) => console.log(label + ':', value ?? '(already done)');
for (const client of [player, bot]) {
  if (await client.balance() < 0.025) metric('Fund ' + client.key, await sponsor.transfer(client.key, 0.05));
  if (!(await client.pack())) metric('Pack request', explorer(await client.requestPack()));
  await until(async () => (await client.pack())?.opened, 65000);
}
const packProof = await proof(packKey(player.key), 'Starter pack opened:', base);
assert.ok(packProof, 'Expected VRF pack fulfillment');
metric('Starter pack VRF', explorer(packProof));

let duel;
if (process.env.DUEL_ADDRESS) {
  duel = await readDuel(new PublicKey(process.env.DUEL_ADDRESS), base);
} else {
  const [card] = (await player.inventory()).filter((x) => x.lock.equals(PublicKey.default));
  assert.ok(card, 'Player has an unlocked card');
  const opened = await player.openDuel(card.key);
  metric('Duel', opened.duel.toBase58());
  metric('Stake 1', explorer(opened.signature));
  duel = await readDuel(opened.duel, base);
}
if (duel.phase === 0) {
  const [card] = (await bot.inventory()).filter((x) => x.lock.equals(PublicKey.default));
  assert.ok(card, 'Bot has an unlocked card');
  metric('Stake 2', explorer(await bot.joinDuel(duel, card.key)));
  duel = await readDuel(duel.key, base);
}
if (duel.phase === 1 && !((await readRound(duel.key, base))?.moves[0] < 3)) {
  const delegated = await bot.delegate(duel);
  metric('Delegation', delegated && explorer(delegated));
  metric('Bot sealed', await bot.lock(duel, 1));
  const botPick = pickKey(duel.key, bot.key);
  const playerView = await (await player.tee()).getAccountInfo(botPick);
  assert.equal(playerView, null, 'Opponent cannot read the private pick account');
  metric('Opponent pick visible before reveal', Boolean(playerView));
  metric('Player sealed', await player.lock(duel, 0));
  metric('Reveal', await player.reveal(duel));
  metric('Commit and undelegate', await player.commit(duel));
  await until(async () => (await readRound(duel.key, base))?.moves[0] < 3, 90000, 1800);
}
duel = await readDuel(duel.key, base);
if (duel.phase === 1) metric('Outcome request', explorer(await player.requestOutcome(duel)));
const result = await until(async () => {
  const current = await readDuel(duel.key, base);
  return current?.phase === 3 && current;
}, 65000);
const cards = await Promise.all([result.card1, result.card2].map((key) => readCard(key, base)));
assert.ok(cards.every((card) => card?.owner.equals(result.winner) && card.lock.equals(PublicKey.default)));
const outcomeProof = await proof(duel.key, 'Demon Duels: winner', base);
assert.ok(outcomeProof, 'Expected VRF settlement and card ownership logs');
metric('Winner', result.winner.toBase58());
metric('Scores', result.scores);
metric('Card 1', result.card1.toBase58());
metric('Card 2', result.card2.toBase58());
metric('Settlement proof', explorer(outcomeProof));
