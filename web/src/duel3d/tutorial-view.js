import { duelHud } from '../game-ui.js';
import { mount } from './index.js';
import { tutorialBeats, tutorialRules } from './tutorial.js';

export function showTutorial(resume) {
  const dialog = document.createElement('dialog');
  dialog.className = 'duel-screen duel-tutorial';
  dialog.setAttribute('aria-labelledby', 'duel-tutorial-title');
  dialog.innerHTML = `<div class="duel-scene">
    <div class="duel-viewport"></div>
    <div class="duel-overlay">
      ${duelHud({ player: { name: 'Hunter', label: 'YOU' }, opponent: { name: 'Sparring partner', label: 'TRAINING' }, phase: 'COMBAT TUTORIAL' })}
    </div>
  </div>
  <div class="duel-panels"><section class="control">
    <div><span class="eyebrow">OFFCHAIN TRAINING · NO STAKES</span><h2 id="duel-tutorial-title">Read the sealed hand</h2>
      <p class="duel-tutorial-rules">${tutorialRules.join(' · ')}</p>
      <p class="duel-tutorial-caption" role="status">Each move has a counter. Watch how the hunters fight.</p>
      <ol class="duel-tutorial-text" hidden>${tutorialBeats.map(({ frame, caption }) => `<li><strong>${frame.label}:</strong> ${caption}</li>`).join('')}</ol>
    </div>
    <div class="actions"><button type="button" class="button secondary" data-tutorial-skip autofocus>Skip tutorial</button>
      <button type="button" class="button primary" data-tutorial-continue disabled>Continue</button></div>
  </section></div>`;
  const skip = dialog.querySelector('[data-tutorial-skip]');
  const next = dialog.querySelector('[data-tutorial-continue]');
  const caption = dialog.querySelector('.duel-tutorial-caption');
  const text = dialog.querySelector('.duel-tutorial-text');
  let view, timer, index = 0;
  const finish = () => {
    clearTimeout(timer);
    view?.dispose();
    dialog.close();
    dialog.remove();
    resume();
  };
  const ready = () => { next.disabled = false; };
  const onUnavailable = () => {
    clearTimeout(timer);
    view = null;
    dialog.classList.add('duel-text-only');
    caption.hidden = true;
    text.hidden = false;
    ready();
  };
  const fighters = ['#d9b382', '#bc99ff'].map((color) => ({ role: 'hunter', color, size: 1.85 }));
  const play = () => {
    const beat = tutorialBeats[index++];
    if (!beat) {
      caption.textContent = 'Training complete. Continue when you’re ready.';
      view.update({ fighters, onUnavailable });
      ready();
      return;
    }
    caption.innerHTML = `<strong>${beat.frame.label}:</strong> ${beat.caption}`;
    view.update({ fighters, frame: beat.frame, onUnavailable });
    timer = setTimeout(play, beat.frame.duration + 500);
  };
  skip.onclick = next.onclick = finish;
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(); });
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  document.body.append(dialog);
  dialog.showModal();
  view = mount(dialog.querySelector('.duel-viewport'), { fighters, onUnavailable });
  if (view) timer = setTimeout(play, 950);
  else onUnavailable();
}
