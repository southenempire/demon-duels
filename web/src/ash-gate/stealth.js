export const ASH_WARDEN = Object.freeze({ opponentKind: 0, mode: 'chain', returnToMap: true });

export function inside(x, z, { x: cx, z: cz, w, d }, padding = 0) {
  return Math.abs(x - cx) < w / 2 + padding && Math.abs(z - cz) < d / 2 + padding;
}

export function obstruction(x, z, toX, toZ, blockers, padding = 0) {
  let nearest = 1;
  for (const b of blockers) {
    let enter = 0, exit = nearest;
    for (const [start, end, center, radius] of [
      [x, toX, b.x, b.w / 2 + padding], [z, toZ, b.z, b.d / 2 + padding],
    ]) {
      const delta = end - start;
      if (delta === 0) {
        if (Math.abs(start - center) >= radius) { enter = 2; break; }
        continue;
      }
      const a = (center - radius - start) / delta, c = (center + radius - start) / delta;
      enter = Math.max(enter, Math.min(a, c));
      exit = Math.min(exit, Math.max(a, c));
    }
    if (enter <= exit) nearest = enter;
  }
  return nearest;
}

export function cameraSweep(from, to, blockers, radius = .18) {
  let nearest = 1;
  for (const b of blockers) {
    let enter = 0, exit = nearest;
    for (const [start, end, min, max] of [
      [from.x, to.x, b.x - b.w / 2 - radius, b.x + b.w / 2 + radius],
      [from.y, to.y, -radius, b.h + radius],
      [from.z, to.z, b.z - b.d / 2 - radius, b.z + b.d / 2 + radius],
    ]) {
      const delta = end - start;
      if (!delta) {
        if (start < min || start > max) { enter = 2; break; }
        continue;
      }
      const a = (min - start) / delta, c = (max - start) / delta;
      enter = Math.max(enter, Math.min(a, c));
      exit = Math.min(exit, Math.max(a, c));
    }
    if (enter <= exit && enter > 0) nearest = enter;
  }
  return nearest;
}

export function sees(watcher, x, z, blockers, hidden) {
  if (hidden) return false;
  const dx = x - watcher.x, dz = z - watcher.z;
  const distance = Math.hypot(dx, dz);
  if (distance > watcher.range) return false;
  if (distance === 0) return true;
  const facing = (-Math.sin(watcher.yaw) * dx - Math.cos(watcher.yaw) * dz) / distance;
  return facing > Math.cos(watcher.halfAngle) && obstruction(watcher.x, watcher.z, x, z, blockers) === 1;
}

export function canStrike(x, z, boss, blockers, alert) {
  const distance = Math.hypot(x - boss.x, z - boss.z);
  return !alert && distance >= .7 && distance <= 2.5 && !sees(boss, x, z, blockers, false)
    && obstruction(x, z, boss.x, boss.z, blockers) === 1;
}

export function mantleTarget(x, z, height, roofs) {
  let closest = null, distance = .86;
  for (const roof of roofs) {
    const rise = roof.h - height;
    if (rise < .25 || rise > 3.10) continue;
    const edgeX = Math.max(roof.x - roof.w / 2, Math.min(roof.x + roof.w / 2, x));
    const edgeZ = Math.max(roof.z - roof.d / 2, Math.min(roof.z + roof.d / 2, z));
    const gap = Math.hypot(edgeX - x, edgeZ - z);
    if (gap >= distance) continue;
    closest = {
      x: Math.max(roof.x - roof.w / 2 + .44, Math.min(roof.x + roof.w / 2 - .44, edgeX)),
      z: Math.max(roof.z - roof.d / 2 + .44, Math.min(roof.z + roof.d / 2 - .44, edgeZ)),
      h: roof.h,
      ...(roof.vaultable ? { vaultable: true } : {}),
    };
    if (roof.vaultable) {
      const dx = x - edgeX, dz = z - edgeZ;
      closest.exit = Math.abs(dx) > Math.abs(dz)
        ? { x: roof.x - Math.sign(dx) * (roof.w / 2 + .43), z: closest.z, land: height }
        : { x: closest.x, z: roof.z - Math.sign(dz || 1) * (roof.d / 2 + .43), land: height };
    }
    distance = gap;
  }
  return closest;
}

export function outcomeOnReturn(settlement, returned) {
  if (settlement?.mode !== 'chain' || settlement.opponentKind !== ASH_WARDEN.opponentKind ||
      !settlement.bossBound || !settlement.duel || settlement.duel !== returned?.duel ||
      returned.mode !== 'chain' || returned.opponentKind !== ASH_WARDEN.opponentKind ||
      typeof settlement.won !== 'boolean') return null;
  return settlement.won ? 'won' : 'lost';
}
