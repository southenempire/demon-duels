import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';

export const PROTOCOL = 'demon-duels/v1';
export const POSE_INTERVAL = 100;
export const HEARTBEAT = 2000;
export const PEER_TTL = 6000;
export const INTERP_DELAY = 150;
export const MAX_SKEW = 30000;
export const CHALLENGE_TTL = 25000;
export const STAKE_TTL = 90000;
export const CHALLENGE_RANGE = 1.5;
const DIRS = ['down', 'left', 'right', 'up'];
const HEADINGS = { up: 0, left: Math.PI / 2, down: Math.PI, right: -Math.PI / 2 };
const KINDS = ['pose', 'bye', 'challenge', 'accept', 'decline', 'cancel', 'staked'];
const SNAP_DISTANCE = 4;
const encoder = new TextEncoder();

export const circleTopic = (circle) => PROTOCOL + '/circle/' + circle;
export const inboxTopic = (id) => PROTOCOL + '/hunter/' + id;
export const hunterName = (id) => 'Hunter ' + id.slice(0, 4) + '…' + id.slice(-4);
export function hunterHue(id) {
  let hue = 0;
  for (const char of id) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  return hue;
}
export const validCircle = (circle) => circle === 'pit' || (Number.isInteger(circle) && circle >= 0 && circle <= 5);

const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
const keyBytes = (id) => {
  try { return typeof id === 'string' && id.length <= 44 ? new PublicKey(id).toBytes() : null; } catch { return null; }
};

export function seal(keypair, body) {
  const text = JSON.stringify({ v: 1, ...body, id: keypair.publicKey.toBase58() });
  return JSON.stringify({ b: text, s: toBase64(nacl.sign.detached(encoder.encode(text), keypair.secretKey)) });
}

const finite = (value) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 10000;
function wellFormed(body) {
  if (body?.v !== 1 || !KINDS.includes(body.k) || !Number.isSafeInteger(body.t)) return false;
  if (body.k === 'pose') {
    return validCircle(body.c) && finite(body.x) && finite(body.y) && DIRS.includes(body.d) &&
      (body.r === undefined || finite(body.r) && Math.abs(body.r) <= Math.PI) &&
      (body.h === undefined || finite(body.h) && body.h >= 0 && body.h <= 8) &&
      typeof body.a === 'string' && /^[a-z-]{1,16}$/.test(body.a);
  }
  if (body.k === 'bye') return true;
  if (!keyBytes(body.to) || typeof body.n !== 'string' || body.n.length > 32) return false;
  return body.k !== 'staked' || Boolean(keyBytes(body.duel));
}

// Returns the signed body, or null for anything malformed, forged or stale.
export function open(raw, now = Date.now()) {
  try {
    const envelope = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
    if (typeof envelope?.b !== 'string' || typeof envelope.s !== 'string' || envelope.b.length > 1024) return null;
    const body = JSON.parse(envelope.b);
    const key = keyBytes(body?.id);
    if (!key || !wellFormed(body) || Math.abs(now - body.t) > MAX_SKEW) return null;
    return nacl.sign.detached.verify(encoder.encode(envelope.b), fromBase64(envelope.s), key) ? body : null;
  } catch { return null; }
}

export function interpolate(samples, time) {
  if (!samples.length) return null;
  let index = samples.length - 1;
  while (index > 0 && samples[index].at > time) index--;
  const from = samples[index];
  const to = samples[index + 1];
  const start = from.r ?? HEADINGS[from.d];
  if (!to || time <= from.at) return { x: from.x, y: from.y, d: from.d, a: from.a, heading: start, height: from.h };
  const f = (time - from.at) / (to.at - from.at);
  const turn = (to.r ?? HEADINGS[to.d]) - start;
  const height = from.h !== undefined && to.h !== undefined ? from.h + (to.h - from.h) * f : from.h;
  return { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f, d: from.d, a: from.a,
    heading: start + Math.atan2(Math.sin(turn), Math.cos(turn)) * f, height };
}

export class PeerTable {
  constructor(self) {
    this.self = self;
    this.peers = new Map();
  }

  receive(body, at) {
    if (body.id === this.self || (body.k !== 'pose' && body.k !== 'bye')) return false;
    let peer = this.peers.get(body.id);
    if (peer && body.t <= peer.t) return false;
    if (body.k === 'bye') return this.peers.delete(body.id);
    if (!peer || peer.circle !== body.c) {
      peer = { id: body.id, name: hunterName(body.id), hue: hunterHue(body.id), circle: body.c, samples: [], warp: at };
      this.peers.set(body.id, peer);
    }
    const last = peer.samples.at(-1);
    if (last && Math.hypot(body.x - last.x, body.y - last.y) > SNAP_DISTANCE) {
      peer.samples = [];
      peer.warp = at;
    }
    peer.samples.push({ at, x: body.x, y: body.y, d: body.d, a: body.a, r: body.r, h: body.h });
    if (peer.samples.length > 8) peer.samples.shift();
    peer.t = body.t;
    peer.seen = at;
    peer.busy = Boolean(body.b);
    return true;
  }

  snapshot(circle, now) {
    const hunters = [];
    for (const [id, peer] of this.peers) {
      if (now - peer.seen > PEER_TTL) { this.peers.delete(id); continue; }
      if (peer.circle !== circle) continue;
      const pose = interpolate(peer.samples, now - INTERP_DELAY);
      hunters.push({ id, name: peer.name, hue: peer.hue, busy: peer.busy, x: pose.x, y: pose.y, dir: pose.d, anim: pose.a,
        heading: pose.heading, height: pose.height, warp: peer.warp });
    }
    return hunters.sort((a, b) => (a.id < b.id ? -1 : 1));
  }

  has(id, circle, now) {
    const peer = this.peers.get(id);
    return Boolean(peer && peer.circle === circle && now - peer.seen <= PEER_TTL);
  }

  clear() { this.peers.clear(); }
}

const nonce = () => toBase64(crypto.getRandomValues(new Uint8Array(9)));

// Offchain handshake only. The duel itself, its stakes and its result live on chain.
export class Negotiator {
  constructor(self) {
    this.self = self;
    this.outgoing = null;
    this.incoming = null;
  }

  busy() { return Boolean(this.outgoing || this.incoming); }

  challenge(to, now) {
    if (this.busy() || to === this.self) return null;
    this.outgoing = { to, n: nonce(), at: now, stage: 'asking' };
    return { k: 'challenge', to, n: this.outgoing.n };
  }

  accept(now) {
    if (this.incoming?.stage !== 'offered') return null;
    Object.assign(this.incoming, { stage: 'accepted', at: now });
    return { k: 'accept', to: this.incoming.from, n: this.incoming.n };
  }

  decline(reason = 'declined') {
    const offer = this.incoming;
    if (!offer) return null;
    this.incoming = null;
    return { k: offer.stage === 'offered' ? 'decline' : 'cancel', to: offer.from, n: offer.n, r: reason };
  }

  cancel(reason = 'cancelled') {
    const ask = this.outgoing;
    if (!ask) return null;
    this.outgoing = null;
    return { k: 'cancel', to: ask.to, n: ask.n, r: reason };
  }

  staked(duel) {
    if (this.outgoing?.stage !== 'staking') return null;
    const { to, n } = this.outgoing;
    this.outgoing = null;
    return { k: 'staked', to, n, duel };
  }

  receive(body, now) {
    if (body.to !== this.self) return null;
    const from = body.id;
    const out = this.outgoing;
    const inc = this.incoming;
    if (body.k === 'challenge') {
      if (inc?.from === from && inc.n === body.n) return null;
      if (this.busy()) return { type: 'reply', reply: { k: 'decline', to: from, n: body.n, r: 'busy' } };
      this.incoming = { from, n: body.n, at: now, stage: 'offered' };
      return { type: 'offer', from };
    }
    if (out?.to === from && out.n === body.n) {
      if (body.k === 'accept' && out.stage === 'asking') {
        Object.assign(out, { stage: 'staking', at: now });
        return { type: 'accepted', to: from };
      }
      if (body.k === 'decline' || body.k === 'cancel') {
        this.outgoing = null;
        return { type: 'declined', to: from, reason: body.r === 'busy' || body.r === 'no-card' ? body.r : 'declined' };
      }
    }
    if (inc?.from === from && inc.n === body.n) {
      if (body.k === 'staked' && inc.stage === 'accepted') {
        this.incoming = null;
        return { type: 'staked', from, duel: body.duel };
      }
      if (body.k === 'cancel') {
        this.incoming = null;
        return { type: 'cancelled', from };
      }
    }
    return null;
  }

  expire(now) {
    const events = [];
    if (this.outgoing?.stage === 'asking' && now - this.outgoing.at > CHALLENGE_TTL) {
      events.push({ type: 'unanswered', to: this.outgoing.to, reply: this.cancel('timeout') });
    }
    const inc = this.incoming;
    if (inc && now - inc.at > (inc.stage === 'offered' ? CHALLENGE_TTL : STAKE_TTL)) {
      this.incoming = null;
      events.push({ type: inc.stage === 'offered' ? 'missed' : 'unstaked', from: inc.from,
        reply: { k: inc.stage === 'offered' ? 'decline' : 'cancel', to: inc.from, n: inc.n, r: 'timeout' } });
    }
    return events;
  }
}
