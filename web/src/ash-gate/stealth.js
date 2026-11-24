export const ASH_WARDEN = Object.freeze({ opponentKind: 0, mode: 'chain', returnToMap: true });

export function worldFrameRuns(menu, active, duelOpen) {
  return active && !duelOpen && ['play', 'loading', 'title'].includes(menu);
}

export function usesWorldKey({ code, target }) {
  if (target?.isContentEditable || target?.closest?.('input, select, textarea')) return false;
  return code !== 'Space' || !target?.closest?.('button, a[href], input, select, textarea, [role="button"]');
}

export const movementBindings = {
  forward: ['KeyW', 'ArrowUp'], backward: ['KeyS', 'ArrowDown'],
  right: ['KeyD', 'ArrowRight'], left: ['KeyA', 'ArrowLeft'],
};

export function movementAxis(keys, positive, negative) {
  return Number(movementBindings[positive].some((key) => keys.has(key))) -
    Number(movementBindings[negative].some((key) => keys.has(key)));
}

export function inside(x, z, { x: cx, z: cz, w, d }, padding = 0) {
  return Math.abs(x - cx) < w / 2 + padding && Math.abs(z - cz) < d / 2 + padding;
}

export function blocksStep(x, z, toX, toZ, wall) {
  if (!inside(toX, toZ, wall, .28)) return false;
  if (!inside(x, z, wall, .28)) return true;
  const clearance = (px, pz) => Math.max(Math.abs(px - wall.x) - wall.w / 2, Math.abs(pz - wall.z) - wall.d / 2);
  const from = clearance(x, z), to = clearance(toX, toZ);
  return to < 0 ? to <= from : to < from;
}

export function blocksRadiusStep(x, z, toX, toZ, center, radius) {
  const to = Math.hypot(toX - center.x, toZ - center.z);
  return to < radius && to <= Math.hypot(x - center.x, z - center.z);
}

export function bossPatrol({ points, speed = 1.4, pause = .7 } = {}) {
  let waypoint = 0, wait = 0;
  return (boss, dt) => {
    if (!points?.length || speed <= 0) return null;
    if (wait > 0) {
      wait -= dt;
      if (wait > 0) return null;
      dt = -wait;
    }
    const target = points[waypoint];
    const dx = target.x - boss.x, dz = target.z - boss.z;
    const distance = Math.hypot(dx, dz);
    const travel = Math.min(distance, speed * dt);
    if (travel === distance) {
      waypoint = (waypoint + 1) % points.length;
      wait = pause;
    }
    if (!travel) return null;
    boss.x += dx * travel / distance;
    boss.z += dz * travel / distance;
    return Math.atan2(-dx, -dz) || 0;
  };
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

export function nextPatrolWaypoint(route, current, { x, z }, walls, canWalk) {
  for (let step = 1; step < route.length; step++) {
    const index = (current + step) % route.length;
    const [toX, toZ] = route[index];
    if (Math.hypot(toX - x, toZ - z) > .1 && canWalk(toX, toZ) && obstruction(x, z, toX, toZ, walls, .12) === 1) return index;
  }
  return (current + 1) % route.length;
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

export function circleRules(hooks = {}) {
  return {
    concealed: (pos, state, fallback) => hooks.concealedAt ? hooks.concealedAt(pos, state) : fallback(),
    detectsBoss: (pos, state, fallback) => hooks.detectsBoss ? hooks.detectsBoss(pos, state) : fallback(),
    canStrikeBoss: (pos, state, fallback) => hooks.canStrikeBoss ? hooks.canStrikeBoss(pos, state) : fallback(),
    canTraverse: (pos) => hooks.canTraverse ? hooks.canTraverse(pos) : true,
    interactionAt: (pos) => hooks.interactionAt?.(pos) ?? null,
    investigateTargets: (time, guard) => hooks.investigateTargets?.(time, guard) ?? [],
    tractionAt: (pos) => Math.max(0, Math.min(1, hooks.tractionAt?.(pos) ?? 1)),
  };
}

export function dampVelocity(current, desired, traction, dt) {
  return traction === 1 ? desired : desired + (current - desired) * Math.exp(-dt * (1.6 + 20 * traction));
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

export function outcomeOnReturn(settlement, returned, opponentKind = ASH_WARDEN.opponentKind) {
  if (settlement?.mode !== 'chain' || settlement.opponentKind !== opponentKind ||
      !settlement.bossBound || !settlement.duel || settlement.duel !== returned?.duel ||
      returned.mode !== 'chain' || returned.opponentKind !== opponentKind ||
      typeof settlement.won !== 'boolean') return null;
  return settlement.won ? 'won' : 'lost';
}
