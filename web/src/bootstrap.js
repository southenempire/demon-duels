import { Buffer } from 'buffer';
import { titleScreen } from './game-ui.js';
import { isAshGate } from './route.js';
import { resolveWorldCircle, worlds } from './worlds.js';
import './game-overlays.css';
import './ash-gate/style.css';

globalThis.Buffer ??= Buffer;
const params = new URLSearchParams(location.search);
const app = document.getElementById('app');

function failed(error) {
  app.innerHTML = '<div class="boot-screen" role="alert"><strong>THE GATES ARE SILENT</strong><small>The arena could not load. Check your connection and try again.</small><button type="button" id="boot-retry">Try again</button></div>';
  document.getElementById('boot-retry').addEventListener('click', () => location.reload());
  console.error(error);
}

async function enterAshGate() {
  app.querySelector('button').disabled = true;
  app.querySelector('[role=status]').textContent = 'Opening Ash Gate…';
  const { getWorldCampaign, launchFight, setExploring } = await import('./main.js');
  const circle = resolveWorldCircle(params, getWorldCampaign());
  const [descriptor, { mountCircle }] = await Promise.all([worlds[circle](), import('./ash-gate/index.js')]);
  try {
    mountCircle(descriptor, { getCampaign: getWorldCampaign, setExploring, startInPlay: true });
  } catch (error) {
    const notice = document.createElement('p');
    notice.setAttribute('role', 'status');
    notice.textContent = descriptor.name + ' needs WebGL 2. You can still challenge its guardian below.';
    app.before(notice);
    launchFight({ opponentKind: descriptor.opponentKind, mode: 'chain', returnToMap: true });
    console.error(error);
  }
}

if (isAshGate(params)) {
  app.innerHTML = '<div class="ash-title-shell">' + titleScreen({
    actions: '<button type="button" class="dd-primary">Enter Ash Gate</button><a href="?world=arena">Enter the Pit</a>',
    loading: 'Ash Gate awaits.',
  }) + '</div>';
  app.querySelector('button').addEventListener('click', () => enterAshGate().catch(failed), { once: true });
} else {
  import('./main.js').catch(failed);
}
