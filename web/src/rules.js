export const moves = [
  { name: 'Rend', icon: 'rend', beats: 'Ward', description: 'Claw through the ward' },
  { name: 'Ward', icon: 'ward', beats: 'Hex', description: 'Reflect dark magic' },
  { name: 'Hex', icon: 'hex', beats: 'Rend', description: 'Curse the attacker' },
];

export const demons = [
  { name: 'Ash Warden', type: 'INFERNAL', art: 'boss_demon.webp', hue: 0, glow: '#ff782d' },
  { name: 'Void Wraith', type: 'ABYSSAL', art: 'demon_enemy_final.webp', hue: 0, glow: '#ba83ff' },
  { name: 'Marrow King', type: 'BONEBORN', art: 'boss_demon.webp', hue: 33, glow: '#ebbf71' },
  { name: 'Mire Phantom', type: 'VENOMOUS', art: 'demon_enemy_final.webp', hue: 100, glow: '#bded40' },
  { name: 'Frost Herald', type: 'GLACIAL', art: 'boss_demon.webp', hue: 171, glow: '#79baff' },
  { name: 'Gloam Shade', type: 'SPECTRAL', art: 'demon_enemy_final.webp', hue: 231, glow: '#66e9ef' },
];

export function resolve(mine, theirs, random) {
  const crits = [random[0] < 64, random[1] < 64];
  const scores = [
    2 + Number((mine + 1) % 3 === theirs) + 2 * Number(crits[0]),
    2 + Number((theirs + 1) % 3 === mine) + 2 * Number(crits[1]),
  ];
  return {
    score: scores,
    crits,
    winner: scores[0] === scores[1] ? random[2] & 1 : Number(scores[1] > scores[0]),
    moves: [mine, theirs],
  };
}

export function practicePack(random = crypto.getRandomValues(new Uint8Array(3))) {
  const first = random[0] % 6;
  const second = (first + 1 + random[1] % 5) % 6;
  const third = [0, 1, 2, 3, 4, 5].filter((id) => id !== first && id !== second)[random[2] % 4];
  return [first, second, third];
}
