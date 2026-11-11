// Week 3 — Local Search: Hill Climbing (N-Queens).
// state[col] = row. conflicts(state) = number of attacking queen pairs (the h to minimize).
export function conflicts(state) {
  let c = 0;
  for (let i = 0; i < state.length; i++)
    for (let j = i + 1; j < state.length; j++)
      if (state[i] === state[j] || Math.abs(state[i] - state[j]) === j - i) c++;
  return c;
}

export function validateN(n) {
  if (!Number.isInteger(n) || n < 4 || n > 30) throw new Error('N must be an integer between 4 and 30');
}

function rng(seed) { // mulberry32 — for reproducible results
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Steepest-ascent hill climbing + random restarts. steps — the state at every step. */
export function hillClimbing(n, { maxRestarts = 20, seed = 1 } = {}) {
  validateN(n);
  if (!Number.isInteger(maxRestarts) || maxRestarts < 0) throw new Error('Restarts must be a non-negative integer');
  const rand = rng(seed);
  const steps = [];
  let state = [];
  for (let restarts = 0; restarts <= maxRestarts; restarts++) {
    state = Array.from({ length: n }, () => Math.floor(rand() * n));
    let cur = conflicts(state);
    steps.push({ state: [...state], h: cur, restart: restarts });
    while (cur > 0) {
      let best = cur, bestMove = null;
      for (let col = 0; col < n; col++) {
        const old = state[col];
        for (let row = 0; row < n; row++) {
          if (row === old) continue;
          state[col] = row;
          const h = conflicts(state);
          if (h < best) { best = h; bestMove = [col, row]; }
        }
        state[col] = old;
      }
      if (!bestMove) break; // local minimum
      state[bestMove[0]] = bestMove[1];
      cur = best;
      steps.push({ state: [...state], h: cur, restart: restarts });
    }
    if (cur === 0) return { solved: true, state, restarts, steps, h: 0 };
  }
  return { solved: false, state, restarts: maxRestarts, steps, h: conflicts(state) };
}
