import { concealedAt, patrols, spawn, throne } from './layout.js';
import { scenery } from './scenery.js';

export const GLOAM_SHADE = {
  id: 5,
  opponentKind: 5,
  name: 'Gloam Throne',
  chapter: 'VI / THE UNDERWORLD',
  objective: ({ y, z, outcome }) => outcome === 'won' ? 'Six guardians fall. The open pit awaits.'
    : outcome === 'lost' ? 'Close is a start. Stay in the light and try again.'
      : z < -10 ? 'Follow the last band of light to the Shade’s flank.'
        : y > .5 ? 'Cross the lit rooftops and drop into the far aisle.'
          : 'Here, the dark is its eyes. Stay in the light and climb the west rooftops.',
  copy: {
    roof: 'Above the patrols',
    hidden: 'Concealed in the light',
    seen: 'The dark is its eyes. Back into the light.',
    alerted: 'Sloppy. I was never sloppy.',
    reset: 'Caught. Follow the lit rooftops past the patrols.',
    strike: 'Everything I bound. That’s the Pact. You forgot it.',
    victory: 'Six guardians fall. The Underworld knows your name. The open pit awaits.',
    defeat: 'Close. Everyone gets close.',
  },
  tells: {
    ghost: ['The founder always struck first. Rend was its way.', 'Hex. Curse the blade before it lands.'],
    shadow: ['The founder favors Rend.'],
  },
  scenery,
  spawn,
  boss: { model: 'gloam-shade.glb', height: 3, pos: throne, facing: Math.PI },
  patrols,
  palette: { background: 0x191529 },
  fog: { color: 0x191529, density: .031 },
  audio: { footstep: 'step-stone' },
  hooks: { concealedAt },
};
