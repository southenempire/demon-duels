import { circles } from '../campaign.js';

export const profileKey = (duel) => 'demon-duels:world-encounter:' + duel;
const grades = new Set(['ghost', 'shadow', 'exposed']);

export function profileFor(detail) {
  if (detail?.mode !== 'chain' || !Number.isInteger(detail.opponentKind) ||
      !circles[detail.opponentKind] || !grades.has(detail.grade)) return null;
  const circle = detail.circle ?? detail.opponentKind;
  if (!Number.isInteger(circle) || !circles[circle]) return null;
  const tells = Array.isArray(detail.tells) ? detail.tells.filter((line) => typeof line === 'string').slice(0, 2) : [];
  return { opponentKind: detail.opponentKind, circle, grade: detail.grade, tells };
}

export function savedProfile(storage, duel) {
  try { return profileFor({ ...JSON.parse(storage.getItem(profileKey(duel))), mode: 'chain' }); }
  catch { return null; }
}

export function huntProfile(spotted, watched, tells) {
  if (tells) {
    const grade = spotted ? 'exposed' : watched ? 'shadow' : 'ghost';
    return { grade, tells: tells[grade] ?? [] };
  }
  return spotted ? { grade: 'exposed', tells: [] } : watched
    ? { grade: 'shadow', tells: ['The Warden usually opens with Ward.'] }
    : { grade: 'ghost', tells: ['The Ash Warden favors Ward.', 'Rend breaks through Ward.'] };
}
