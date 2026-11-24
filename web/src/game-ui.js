// Shared title treatment. The world can supply its own data-hunt actions;
// the arena supplies data-action buttons. Neither flow is coupled to this view.
export function titleScreen({ actions, loading = '' } = {}) {
  return `<section class="game-title" aria-labelledby="game-title">
    <div class="title-landscape" aria-hidden="true"></div>
    <div class="title-moon" aria-hidden="true"></div>
    <div class="title-hunter" aria-hidden="true"></div>
    <div class="title-ash" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
    <div class="title-copy">
      <span class="title-kicker">AN UNDERWORLD CHRONICLE</span>
      <h1 class="title-logo" id="game-title">DEMON<span>DUELS</span></h1>
      <div class="title-chapter"><i></i> THE SEALED HAND <i></i></div>
      <p class="title-lore">You lost your name.<br>Make the Underworld remember.</p>
      <nav class="title-menu" aria-label="Main menu">${actions || ''}</nav>
      ${loading ? `<div class="title-loading">${loading}</div>` : ''}
    </div>
    <div class="title-edition"><span>CHAPTER I <i>—</i> THE DESCENT</span><span>SOLANA DEVNET <i>·</i> TEST TOKENS ONLY</span></div>
  </section>`;
}

export function installDialogKeys(root) {
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const dialog = root.querySelector('[role="dialog"]');
    if (!dialog) return;
    const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]')]
      .filter((element) => element.getClientRects().length);
    const first = controls[0];
    const last = controls.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  });
}
