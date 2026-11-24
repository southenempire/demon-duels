const preferences = [[1, 0, 2], [2, 1, 0], [0, 2, 1], [2, 1, 0], [1, 0, 2], [0, 2, 1]];

export function bossMove(kind, grade, roll) {
  const order = preferences[kind];
  if (!order || (grade !== 'ghost' && grade !== 'shadow')) return Math.floor(roll * 3);
  if (grade === 'ghost') return order[roll < 0.60 ? 0 : roll < 0.90 ? 1 : 2];
  return order[roll < 0.45 ? 0 : roll < 0.80 ? 1 : 2];
}
