const loadManifest = (url) => fetch(url).then((response) => response.ok ? response.json() : null).catch(() => null);

export function installHuntAudio(base, signal, { ambient } = {}) {
  const documentAudio = document.createElement('audio');
  const supportsOgg = Boolean(documentAudio.canPlayType('audio/ogg; codecs="vorbis"'));
  const manifest = loadManifest(base + 'world/audio/manifest.json');
  const buffers = new Map();
  const sources = new Set();
  const recent = new Map();
  let context;
  let bus;
  let desiredCircle = null;
  let music;
  let token = 0;
  let enabled = false;
  let alert = 'unaware';

  function fetchBuffer(asset) {
    if (!buffers.has(asset.id)) {
      const get = (path) => fetch(base + path).then((response) => {
        if (!response.ok) throw new Error('Exploration sound unavailable');
        return response.arrayBuffer();
      }).then((bytes) => context.decodeAudioData(bytes));
      const { ogg, mp3 } = asset.files;
      buffers.set(asset.id, (supportsOgg ? get(ogg).catch(() => get(mp3)) : get(mp3)).catch(() => {
        buffers.delete(asset.id);
        return null;
      }));
    }
    return buffers.get(asset.id);
  }

  function start(asset, buffer, at, gain, pack) {
    const source = context.createBufferSource();
    const volume = context.createGain();
    source.buffer = buffer;
    volume.gain.setValueAtTime(gain, at);
    source.connect(volume).connect(bus);
    if (asset.loop) {
      source.loop = true;
      source.loopStart = asset.loop_points.start_sample / pack.sample_rate_hz;
      source.loopEnd = Math.min(buffer.duration, asset.loop_points.end_sample_exclusive / pack.sample_rate_hz);
    }
    source.start(at, source.loopStart);
    sources.add(source);
    source.onended = () => { sources.delete(source); source.disconnect(); volume.disconnect(); };
    return { source, volume, asset };
  }

  function stopMusic() {
    for (const track of music?.tracks ?? []) {
      track.volume.gain.setTargetAtTime(0, context.currentTime, 0.055);
      track.source.stop(context.currentTime + 0.24);
    }
    music = undefined;
  }

  function mix() {
    if (!music) return;
    const active = music.bindings[alert];
    for (const track of music.tracks) {
      if (track.asset.category !== 'music') continue;
      const { gain } = track.volume;
      gain.cancelScheduledValues(context.currentTime);
      gain.setTargetAtTime(track.asset.id === active ? track.asset.suggested_volume : 0, context.currentTime, music.fade / 3);
    }
  }

  async function playCircle() {
    const generation = ++token;
    stopMusic();
    if (!context || !enabled || desiredCircle === null) return;
    const pack = await manifest;
    if (!pack || generation !== token) return;
    const bindings = pack.event_bindings['demon-duels:world-state'].alert_to_asset_id;
    const selected = [ambient ?? 'amb-circle-' + desiredCircle, ...Object.values(bindings)];
    const assets = selected.map((id) => pack.assets.find((asset) => asset.id === id)).filter(Boolean);
    const clips = await Promise.all(assets.map((asset) => fetchBuffer(asset)));
    if (generation !== token || signal.aborted) return;
    const at = context.currentTime + 0.05;
    const tracks = assets.flatMap((asset, i) => clips[i] ? [
      start(asset, clips[i], at, asset.category === 'ambience' || bindings[alert] === asset.id ? asset.suggested_volume : 0, pack),
    ] : []);
    music = { tracks, bindings, fade: pack.music_sync.crossfade_seconds };
  }

  window.addEventListener('demon-duels:world-state', ({ detail }) => {
    if (detail?.circle !== desiredCircle) return;
    alert = detail.alert;
    mix();
  }, { signal });
  window.addEventListener('demon-duels:audio', async ({ detail }) => {
    if (!enabled || !context || document.hidden || !detail?.cue || detail.cue.startsWith('amb-circle-')) return;
    const pack = await manifest;
    if (!pack || signal.aborted || !enabled) return;
    const cues = pack.event_bindings['demon-duels:audio'].cue_to_asset_ids[detail.cue];
    if (!Array.isArray(cues) || !cues.length) return;
    const index = ((recent.get(detail.cue) ?? -1) + 1) % cues.length;
    recent.set(detail.cue, index);
    const asset = pack.assets.find(({ id }) => id === cues[index]);
    const buffer = asset && await fetchBuffer(asset);
    if (buffer && enabled && !signal.aborted && !document.hidden) start(asset, buffer, context.currentTime, asset.suggested_volume, pack);
  }, { signal });
  document.addEventListener('visibilitychange', () => {
    if (!context || !enabled) return;
    (document.hidden ? context.suspend() : context.resume()).catch(() => {});
  }, { signal });
  signal.addEventListener('abort', () => {
    token++;
    if (context) context.close().catch(() => {});
  }, { once: true });
  return {
    enable(value) {
      if (enabled === value) return;
      enabled = value;
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (enabled && Audio) {
        if (!context) {
          context = new Audio();
          bus = context.createGain();
          bus.connect(context.destination);
        }
        context.resume().catch(() => {});
        playCircle().catch(() => {});
      } else if (context) {
        token++;
        for (const source of sources) { try { source.stop(); } catch { /* already ended */ } }
        music = undefined;
        context.suspend().catch(() => {});
      }
    },
    circle(kind) {
      if (desiredCircle === kind) return;
      desiredCircle = kind;
      alert = 'unaware';
      playCircle().catch(() => {});
    },
  };
}
