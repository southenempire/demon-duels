import { finisherScene } from './scenes.js';

const art = (import.meta.env?.BASE_URL ?? './') + 'art/';
const shortId = (id) => id.length > 12 ? id.slice(0, 5) + '…' + id.slice(-5) : id;
const gradeLabels = { ghost: 'GHOST / SILENT', shadow: 'SHADOW / STANDARD', exposed: 'EXPOSED / BRUTAL' };
const hunterPoses = {
  strike: { lead: 900, frames: [90, 110, 70, 150, 120, 160], still: 3 },
  finisher: { lead: 420, frames: [260, 160, 240, 90, 420, 500], still: 4 },
  hit: { lead: 1000, frames: [170, 150, 120], still: 2 },
};
const sceneDuration = 4000;

function animateHunter(image, { lead, frames, still }, reduced) {
  const frameAt = (i) => `translateX(${-100 * i / frames.length}%)`;
  image.style.width = (100 * frames.length) + '%';
  if (reduced || !image.animate) {
    image.style.transform = frameAt(still);
    return;
  }
  let elapsed = lead;
  const keyframes = [{ offset: 0, transform: frameAt(0), easing: 'step-end' }];
  for (const [i, duration] of frames.entries()) {
    keyframes.push({ offset: elapsed / sceneDuration, transform: frameAt(i), easing: 'step-end' });
    elapsed += duration;
  }
  keyframes.push({ offset: 1, transform: frameAt(frames.length - 1) });
  image.animate(keyframes, { duration: sceneDuration, fill: 'both' });
}

function playScene(scene, detail, { grade = 'shadow', sound, worldImpact, preview = false } = {}) {
  const pose = !detail.won ? 'hit' : grade === 'ghost' ? 'strike' : 'finisher';
  const dialog = document.createElement('dialog');
  dialog.className = 'finisher';
  dialog.dataset.effect = scene.effect;
  dialog.dataset.grade = detail.won ? grade : 'defeat';
  dialog.style.setProperty('--finisher-ink', scene.color);
  dialog.style.setProperty('--hunter-lead', hunterPoses[pose].lead + 'ms');
  dialog.setAttribute('aria-labelledby', 'finisher-title');
  dialog.setAttribute('aria-describedby', 'finisher-line');
  dialog.innerHTML = `
    <div class="finisher-top"><span>UNDERWORLD / CIRCLE ${scene.circle}</span><span>${preview ? 'DEVELOPMENT PREVIEW' : 'SETTLEMENT CONFIRMED'}</span></div>
    <div class="finisher-stage" aria-hidden="true">
      <div class="finisher-ring"></div>
      <img class="finisher-boss finisher-boss-before" alt="" src="${art + scene.opening}">
      <img class="finisher-boss finisher-boss-after" alt="" src="${art + scene.ending}">
      <div class="finisher-hunter">
        <img class="finisher-hunter-idle" alt="" src="${art}world/hunter/duel/idle.png">
        <img class="finisher-hunter-action" alt="" src="${art}world/hunter/duel/${pose}.png">
      </div>
      <div class="finisher-cut"></div>
      <svg class="finisher-sigil" viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${scene.sigil}</svg>
    </div>
    <div class="finisher-copy">
      <p class="finisher-label">${scene.boss} <span>/</span> ${detail.won ? gradeLabels[grade] : 'HUNT FAILED'}</p>
      <h2 id="finisher-title">${scene.title}</h2>
      <p id="finisher-line">${scene.line}</p>
    </div>
    <div class="finisher-bottom">
      <span class="finisher-receipt"></span>
      <button type="button" autofocus>Skip <kbd>Esc</kbd></button>
    </div>`;
  dialog.querySelector('.finisher-receipt').textContent = 'Duel ' + shortId(detail.duel) +
    (typeof detail.proof === 'string' && detail.proof ? ' / Proof ' + shortId(detail.proof) : '');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  return new Promise((resolve) => {
    let impact, done = false;
    const timeout = setTimeout(finish, reduced ? 1850 : sceneDuration);
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      clearTimeout(impact);
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve();
    }
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(); });
    dialog.addEventListener('close', finish, { once: true });
    dialog.querySelector('button').addEventListener('click', finish, { once: true });
    try {
      document.body.append(dialog);
      dialog.showModal();
      animateHunter(dialog.querySelector('.finisher-hunter-action'), hunterPoses[pose], reduced);
      if (worldImpact && detail.won) {
        impact = setTimeout(() => worldImpact(detail), reduced ? 0 : 1170);
      } else if (sound && (!detail.won || grade !== 'ghost')) {
        const victor = detail.won ? 0 : 1;
        const cue = detail.result?.crits?.[victor] ? 'crit' : grade === 'exposed' ? 'rend' : 'strike';
        impact = setTimeout(() => sound(cue), reduced ? 0 : 1170);
      }
    } catch {
      finish();
    }
  });
}

export function campaignApproval(storage, detail) {
  const { duel, opponentKind, player } = detail;
  if (storage.getItem('demon-duels:boss:' + duel) !== String(opponentKind)) return null;
  const accepted = () => {
    try {
      const journal = JSON.parse(storage.getItem('demon-duels:campaign:v1:' + player));
      return journal?.version === 1 && Array.isArray(journal.wins) &&
        journal.wins.some((win) => win?.duel === duel && win.bossId === opponentKind);
    } catch { return false; }
  };
  const alreadyAccepted = accepted();
  return () => !alreadyAccepted && accepted();
}

export function matchesBossStake(detail, requestedKind, room, opponent, card, binding) {
  return detail?.mode === 'chain' && detail.duel === room &&
    Number.isInteger(requestedKind) && detail.opponentKind === requestedKind &&
    binding?.kind === requestedKind && Boolean(binding.player && binding.card) &&
    binding.player === opponent && binding.card === card;
}

export function installFinishers(target, accept, render) {
  const seen = new Set();
  let pending, request;
  target.addEventListener('demon-duels:settled', ({ detail }) => {
    const scene = accept(detail) && finisherScene(detail);
    if (!scene || seen.has(detail.duel)) return;
    seen.add(detail.duel);
    pending = { scene, detail };
  });
  target.addEventListener('demon-duels:finisher', ({ detail }) => {
    if (!detail || !Object.hasOwn(gradeLabels, detail.grade)) return;
    const { duel, opponentKind, grade } = detail;
    queueMicrotask(() => {
      const settlement = pending?.detail;
      if (settlement && settlement.duel === duel && settlement.opponentKind === opponentKind && settlement.won) {
        request = { duel, grade };
      }
    });
  });
  return {
    clear() { pending = undefined; request = undefined; },
    has(duel) { return Boolean(pending && pending.detail.duel === duel); },
    async play(duel) {
      if (!pending || pending.detail.duel !== duel) return;
      const { scene, detail } = pending;
      const grade = request?.duel === duel ? request.grade : 'shadow';
      pending = undefined;
      request = undefined;
      try {
        await render(scene, detail, grade);
      } finally {
        target.dispatchEvent(new CustomEvent('demon-duels:finisher-done', { detail: { opponentKind: detail.opponentKind } }));
      }
    },
  };
}

export const settlementCinematics = (target, accept, sound, worldImpact) =>
  installFinishers(target, accept, (scene, detail, grade) => playScene(scene, detail, {
    grade, sound, worldImpact: worldImpact?.(detail),
  }));

export function previewFinisher(params) {
  if (!params.has('finisher')) return;
  const detail = {
    mode: 'chain', duel: 'PreviewDuel111111111111111',
    proof: 'PreviewProof111111111111111', opponentKind: Number(params.get('finisher')),
    won: params.get('won') !== '0',
  };
  const scene = finisherScene(detail);
  const grade = Object.hasOwn(gradeLabels, params.get('grade')) ? params.get('grade') : 'shadow';
  if (scene) return playScene(scene, detail, { grade, preview: true });
}
