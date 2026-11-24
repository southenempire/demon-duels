import './presence.css';
import {
  CHALLENGE_RANGE, HEARTBEAT, Negotiator, POSE_INTERVAL, PeerTable,
  circleTopic, hunterName, inboxTopic, open, seal, validCircle,
} from './presence.js';

const env = import.meta.env ?? {};
const BROKERS = (env.VITE_PRESENCE_BROKERS || 'wss://broker.emqx.io:8084/mqtt,wss://test.mosquitto.org:8081/mqtt')
  .split(',').map((url) => url.trim()).filter(Boolean);
const SNAPSHOT_INTERVAL = 50;
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reasons = {
  busy: 'is busy with another duel.', 'no-card': 'has no unstaked card right now.', declined: 'declined your challenge.',
  timeout: 'did not answer.', left: 'left the circle.',
};

// Live hunters in the stealth world. Positions travel over public MQTT relays, signed by each
// guest wallet; the challenge becomes the existing onchain PvP duel. Relay failures stay silent.
export function startPresence({ keypair, host, check, verify, brokers = BROKERS }) {
  const self = keypair.publicKey.toBase58();
  const peers = new PeerTable(self);
  const talks = new Negotiator(self);
  let clients = [];
  let connecting = null;
  let circle = null;
  let pose = null;
  let sentAt = 0;
  let sentPose = '';
  let clock = 0;
  let lastCount = -1;
  let panel = null;
  let notice = null;

  const stamp = () => (clock = Math.max(clock + 1, Date.now()));
  const publish = (topic, body) => {
    const raw = seal(keypair, { ...body, t: stamp() });
    for (const client of clients) if (client.connected) client.publish(topic, raw, { qos: 0 });
  };
  const direct = (body) => body && publish(inboxTopic(body.to), body);

  function connect() {
    connecting ??= import('mqtt').then(({ default: mqtt }) => {
      clients = brokers.map((url) => {
        const client = mqtt.connect(url, {
          clientId: 'dd-' + self.slice(0, 8) + '-' + Math.random().toString(36).slice(2, 8),
          clean: true, keepalive: 30, connectTimeout: 8000, reconnectPeriod: 5000, resubscribe: false,
        });
        client.on('connect', () => {
          client.subscribe(inboxTopic(self));
          if (circle !== null) client.subscribe(circleTopic(circle));
          sentAt = 0;
        });
        client.on('message', (_topic, payload) => receive(payload));
        client.on('error', () => {});
        return client;
      });
    }).catch(() => { connecting = null; });
    return connecting;
  }

  function receive(payload) {
    const now = Date.now();
    const body = open(payload, now);
    if (!body || body.id === self) return;
    if (body.k === 'pose' || body.k === 'bye') { peers.receive(body, now); return; }
    if (body.k === 'challenge' && (circle === null || !peers.has(body.id, circle, now))) return;
    handle(talks.receive(body, now));
  }

  function enter(next) {
    if (next === circle) return;
    if (circle !== null) {
      publish(circleTopic(circle), { k: 'bye' });
      for (const client of clients) if (client.connected) client.unsubscribe(circleTopic(circle));
    }
    circle = next;
    peers.clear();
    sentPose = '';
    lastCount = -1;
    if (circle === null) {
      direct(talks.cancel('left'));
      direct(talks.decline('left'));
      render();
      return;
    }
    connect();
    for (const client of clients) if (client.connected) client.subscribe(circleTopic(circle));
  }

  function tick() {
    const now = Date.now();
    for (const event of talks.expire(now)) { direct(event.reply); handle(event); }
    if (circle === null) return;
    const hunters = peers.snapshot(circle, now);
    if (hunters.length || lastCount !== 0) {
      lastCount = hunters.length;
      window.dispatchEvent(new CustomEvent('demon-duels:hunters', { detail: { circle, hunters } }));
    }
    if (!pose) return;
    const state = JSON.stringify([pose.x.toFixed(2), pose.y.toFixed(2), pose.dir, pose.anim, talks.busy()]);
    if (now - sentAt >= (state === sentPose ? HEARTBEAT : POSE_INTERVAL)) {
      sentAt = now;
      sentPose = state;
      publish(circleTopic(circle), { k: 'pose', c: circle, x: +pose.x.toFixed(2), y: +pose.y.toFixed(2), d: pose.dir, a: pose.anim, b: talks.busy() ? 1 : 0 });
    }
  }

  async function challenge(id) {
    const now = Date.now();
    if (circle === null || talks.busy() || !peers.has(id, circle, now)) return;
    const target = peers.snapshot(circle, now).find((hunter) => hunter.id === id);
    if (pose && target && Math.hypot(target.x - pose.x, target.y - pose.y) > CHALLENGE_RANGE + 1) return;
    const message = talks.challenge(id, now);
    if (!message) return;
    render();
    const ready = await check().catch((error) => ({ ok: false, reason: error.message }));
    if (!ready.ok) { talks.cancel('no-card'); toast(ready.reason); return; }
    if (talks.outgoing?.n !== message.n) return;
    direct(message);
    render();
  }

  async function accept() {
    const offer = talks.incoming;
    if (offer?.stage !== 'offered') return;
    const ready = await check().catch((error) => ({ ok: false, reason: error.message }));
    if (talks.incoming !== offer) return;
    if (!ready.ok) { direct(talks.decline('no-card')); toast(ready.reason); return; }
    direct(talks.accept(Date.now()));
    render();
  }

  async function handle(event) {
    if (!event) return;
    if (event.type === 'reply') { direct(event.reply); return; }
    if (event.type === 'offer') { render(); return; }
    if (event.type === 'declined') { toast(hunterName(event.to) + ' ' + (reasons[event.reason] || reasons.declined)); return; }
    if (event.type === 'unanswered') { toast(hunterName(event.to) + ' ' + reasons.timeout); return; }
    if (event.type === 'cancelled') { toast(hunterName(event.from) + ' withdrew the challenge.'); return; }
    if (event.type === 'missed') { render(); return; }
    if (event.type === 'unstaked') { toast(hunterName(event.from) + ' never staked. No card was taken.'); return; }
    if (event.type === 'accepted') {
      render();
      try {
        const duel = await host(() => talks.outgoing?.to === event.to && talks.outgoing.stage === 'staking');
        const staked = talks.staked(duel);
        if (staked) direct(staked);
        else toast(hunterName(event.to) + ' backed out. Cancel the duel to get your card back.');
        render();
        launch(duel, false);
      } catch (error) {
        direct(talks.cancel('busy'));
        toast(error.message || 'Your card could not be staked.');
      }
      return;
    }
    if (event.type === 'staked') {
      render();
      try {
        await verify(event.duel, event.from);
        launch(event.duel, true);
      } catch (error) {
        toast(error.message || 'That duel could not be verified on chain.');
      }
    }
  }

  function launch(room, join) {
    render();
    window.dispatchEvent(new CustomEvent('demon-duels:launch', {
      detail: { mode: 'pvp', room, join, returnToMap: true, source: 'presence' },
    }));
  }

  function toast(text) {
    notice = { text, until: Date.now() + 5000 };
    render();
    setTimeout(render, 5100);
  }

  function render() {
    panel ??= Object.assign(document.createElement('aside'), { className: 'hunter-presence', role: 'status' });
    if (!panel.isConnected) document.body.append(panel);
    const out = talks.outgoing;
    const inc = talks.incoming;
    let html = '';
    if (inc?.stage === 'offered') {
      html = '<b>' + esc(hunterName(inc.from)) + ' challenges you</b><span>Stake a card. Winner takes both, settled on Solana.</span>' +
        '<div><button type="button" class="button primary" data-presence="accept">Accept duel</button>' +
        '<button type="button" class="button secondary" data-presence="decline">Decline</button></div>';
    } else if (inc?.stage === 'accepted') {
      html = '<b>Duel accepted</b><span>Waiting for ' + esc(hunterName(inc.from)) + ' to stake on Solana…</span>' +
        '<div><button type="button" class="button text" data-presence="decline">Back out</button></div>';
    } else if (out?.stage === 'asking') {
      html = '<b>Challenge sent</b><span>Waiting for ' + esc(hunterName(out.to)) + ' to answer…</span>' +
        '<div><button type="button" class="button text" data-presence="cancel">Cancel</button></div>';
    } else if (out?.stage === 'staking') {
      html = '<b>' + esc(hunterName(out.to)) + ' accepted</b><span>Staking your card on Solana…</span>';
    } else if (notice && Date.now() < notice.until) {
      html = '<span>' + esc(notice.text) + '</span>';
    }
    panel.innerHTML = html;
    panel.hidden = !html;
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-presence]');
    if (!button) return;
    const name = button.dataset.presence;
    if (name === 'accept') accept();
    if (name === 'decline') { direct(talks.decline('declined')); render(); }
    if (name === 'cancel') { direct(talks.cancel('cancelled')); render(); }
  });
  window.addEventListener('demon-duels:hunter-pose', (event) => {
    const detail = event.detail ?? {};
    if (detail.circle === null || detail.circle === undefined) { pose = null; enter(null); return; }
    if (!validCircle(detail.circle) || !Number.isFinite(detail.x) || !Number.isFinite(detail.y)) return;
    pose = { x: detail.x, y: detail.y, dir: detail.dir || 'down', anim: /^[a-z-]{1,16}$/.test(detail.anim) ? detail.anim : 'idle' };
    enter(detail.circle);
  });
  window.addEventListener('demon-duels:challenge-hunter', (event) => challenge(event.detail?.id));
  addEventListener('pagehide', () => { if (circle !== null) publish(circleTopic(circle), { k: 'bye' }); });
  setInterval(tick, SNAPSHOT_INTERVAL);
  return { peers, talks, challenge, accept };
}
