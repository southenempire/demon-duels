import { surfaceAt } from './layout.js';

const lifetime = 8;
export const maxTracks = 48;

export function createTracks() {
  let tracks = [], lastStep, side = 1;
  return {
    reset() {
      tracks = [];
      lastStep = undefined;
      side = 1;
    },
    onStep(pos) {
      const previous = lastStep;
      lastStep = { x: pos.x, z: pos.z };
      if (surfaceAt(pos) !== 'snow') return;
      const dx = previous ? pos.x - previous.x : 0;
      const dz = previous ? pos.z - previous.z : -1;
      const yaw = Math.atan2(-dx, -dz);
      const offset = .105 * side;
      side *= -1;
      tracks.push({ pos: { ...lastStep }, yaw, offset, until: null });
      if (tracks.length > maxTracks) tracks.shift();
    },
    at(time) {
      for (const track of tracks) if (track.until === null) track.until = time + lifetime;
      while (tracks.length && tracks[0].until <= time) tracks.shift();
      return tracks;
    },
  };
}
