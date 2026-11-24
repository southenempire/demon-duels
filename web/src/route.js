export function isAshGate(params) {
  return !params.has('room') && (params.get('world') === '3d' || !params.has('world'));
}
