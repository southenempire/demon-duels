export const profileKey = (duel) => 'demon-duels:world-encounter:' + duel;
const grades = new Set(['ghost', 'shadow', 'exposed']);

export function profileFor(detail) {
  if (detail?.mode !== 'chain' || detail.opponentKind !== 0 || !grades.has(detail.grade)) return null;
  const tells = Array.isArray(detail.tells) ? detail.tells.filter((line) => typeof line === 'string').slice(0, 2) : [];
  return { opponentKind: 0, grade: detail.grade, tells };
}

export function savedProfile(storage, duel) {
  try { return profileFor({ ...JSON.parse(storage.getItem(profileKey(duel))), mode: 'chain' }); }
  catch { return null; }
}

export function huntProfile(spotted, watched) {
  return spotted ? { grade: 'exposed', tells: [] } : watched
    ? { grade: 'shadow', tells: ['The Warden usually opens with Ward.'] }
    : { grade: 'ghost', tells: ['The Ash Warden favors Ward.', 'Rend breaks through Ward.'] };
}
