const cues = {
  seal: 'sfx_seal', stake: 'sfx_stake', strike: 'sfx_hit', crit: 'sfx_vrf_crit',
  victory: 'sfx_victory', defeat: 'sfx_defeat', transfer: 'sfx_card_transfer',
  rend: 'sfx_attack_rend', ward: 'sfx_attack_ward', hex: 'sfx_attack_hex',
};

// Original Demon Duels audio pack, CC0. Fire on state edges, never renders.
export class PitSound {
  constructor(base) {
    this.base = base; this.enabled = false; this.context = null;
    this.buffers = new Map(); this.sources = new Set();
    this.music = null; this.activeMusic = null; this.scene = 'menu'; this.generation = 0;
    document.addEventListener('visibilitychange', () => {
      if (!this.context) return;
      if (document.hidden) this.context.suspend().catch(() => {});
      else if (this.enabled) this.context.resume().catch(() => {});
    });
  }
  unlock(enabled) {
    if (!enabled) {
      this.enabled = false; this.generation++;
      for (const source of this.sources) { try { source.stop(); } catch { /* Already ended. */ } }
      this.sources.clear(); this.music = null; this.activeMusic = null;
      this.context?.suspend().catch(() => {}); return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.enabled = true;
    if (!this.context) {
      this.context = new AudioContext();
      this.musicBus = this.context.createGain();
      this.musicBus.connect(this.context.destination);
    }
    this.context.resume().catch(() => {});
    this.setScene(this.scene);
    for (const cue of Object.values(cues)) this.buffer(cue);
  }
  buffer(name) {
    if (!this.buffers.has(name)) this.buffers.set(name, fetch(this.base + name + '.ogg')
      .then((response) => { if (!response.ok) throw new Error('Audio unavailable'); return response.arrayBuffer(); })
      .then((bytes) => this.context.decodeAudioData(bytes))
      .catch(() => { this.buffers.delete(name); return null; }));
    return this.buffers.get(name);
  }
  source(buffer, gain, destination = this.context.destination) {
    const source = this.context.createBufferSource();
    const volume = this.context.createGain();
    source.buffer = buffer; volume.gain.value = gain;
    source.connect(volume).connect(destination);
    this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); volume.disconnect(); };
    return { source, volume };
  }
  setScene(scene) {
    this.scene = scene;
    if (!this.enabled || !this.context || this.music?.scene === scene) return;
    const marker = { scene, source: null };
    const generation = this.generation;
    this.music = marker;
    this.buffer('music_' + scene).then((buffer) => {
      if (!buffer || !this.enabled || generation !== this.generation || this.music !== marker) return;
      const next = this.source(buffer, 0, this.musicBus);
      const previous = this.activeMusic;
      Object.assign(marker, next);
      this.activeMusic = marker;
      const now = this.context.currentTime;
      next.source.loop = true; next.source.loopStart = 0;
      next.source.loopEnd = Math.min(822857 / 48000, buffer.duration);
      next.volume.gain.linearRampToValueAtTime(scene === 'fight' ? 0.28 : 0.32, now + 0.3);
      next.source.start();
      if (previous?.source) {
        previous.volume.gain.cancelScheduledValues(now);
        previous.volume.gain.setValueAtTime(previous.volume.gain.value, now);
        previous.volume.gain.linearRampToValueAtTime(0, now + 0.3);
        previous.source.stop(now + 0.31);
      }
    });
  }
  play(name) {
    if (!this.enabled || !this.context || !cues[name]) return;
    const generation = this.generation;
    this.buffer(cues[name]).then((buffer) => {
      if (!buffer || !this.enabled || generation !== this.generation || document.hidden) return;
      const stinger = name === 'victory' || name === 'defeat';
      const { source } = this.source(buffer, stinger ? 0.63 : 0.72);
      source.start();
      if (stinger) {
        const now = this.context.currentTime;
        this.musicBus.gain.cancelScheduledValues(now);
        this.musicBus.gain.setValueAtTime(0.32, now);
        this.musicBus.gain.setValueAtTime(0.32, now + buffer.duration);
        this.musicBus.gain.linearRampToValueAtTime(1, now + buffer.duration + 0.4);
      }
    });
  }
}
