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

async function loadWorld() {
  const { getWorldCampaign, launchFight, setExploring, setWorldUnavailable } = await import('./main.js');
  const circle = resolveWorldCircle(params, getWorldCampaign());
  const [descriptor, { mountCircle }] = await Promise.all([worlds[circle](), import('./ash-gate/index.js')]);
  return { name: descriptor.name, enter: () => mountCircle(descriptor, {
    getCampaign: getWorldCampaign,
    setExploring,
    startInPlay: true,
    onRendererUnavailable(error) {
      setWorldUnavailable();
      launchFight({ opponentKind: descriptor.opponentKind, mode: 'chain', returnToMap: true });
      console.error(error);
    },
  }) };
}

function showTitle(name, enter) {
  app.innerHTML = '<div class="ash-title-shell">' + titleScreen({
    actions: '<button type="button" class="dd-primary"></button><a href="?world=arena">Enter the Pit</a>',
    loading: 'Loading circle…',
  }) + '</div>';
  const button = app.querySelector('button');
  const status = app.querySelector('[role=status]');
  button.textContent = name ? 'Enter ' + name : 'Enter circle';
  button.disabled = !enter;
  if (name) status.textContent = name + ' awaits.';
  if (enter) button.addEventListener('click', () => {
    button.disabled = true;
    status.textContent = 'Opening ' + name + '…';
    Promise.resolve().then(enter).catch(failed);
  }, { once: true });
}

if (isAshGate(params)) {
  const requested = params.get('circle');
  if (requested === null || /^0+$/.test(requested)) {
    showTitle('Ash Gate', async () => (await loadWorld()).enter());
  } else {
    showTitle(null);
    loadWorld().then(({ name, enter }) => showTitle(name, enter)).catch(failed);
  }
} else {
  import('./main.js').catch(failed);
}
