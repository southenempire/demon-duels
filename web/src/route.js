export function isAshGate(params) {
  return !params.has('room') && (params.get('world') === '3d' || !params.has('world'));
}

export function initialJourney(params, storySeen) {
  if (params.has('room') || params.get('world') === 'arena') return 'arena';
  return storySeen ? 'map' : 'story';
}
