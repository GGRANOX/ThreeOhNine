// Нақты өлшеулер: node scripts/benchmark.mjs  -> consola + docs/benchmark-results.json
import { writeFileSync } from 'node:fs';
import { solve, makeGrid } from '../src/search.js';
import { hillClimbing } from '../src/localsearch.js';
import { minimax, alphaBeta } from '../src/adversarial.js';

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const REPS = 100;
const out = { search: {}, queens: [], ttt: [] };

// --- Апта 2 ---
const scenarios = {
  'Ашық тор 30x30': () => ({ g: makeGrid(30, 30), s: [0, 0], t: [29, 29] }),
  'Лабиринт 15x25 (екі қабырға)': () => {
    const g = makeGrid(15, 25);
    for (let r = 0; r <= 10; r++) g[r][8] = 0;
    for (let r = 4; r <= 14; r++) g[r][16] = 0;
    return { g, s: [7, 3], t: [7, 21] };
  },
  'Кездейсоқ 25% қабырға 30x30 (seed 2)': () => {
    const R = rng(2), g = makeGrid(30, 30);
    for (let r = 0; r < 30; r++) for (let c = 0; c < 30; c++) if (R() < 0.25) g[r][c] = 0;
    g[0][0] = 1; g[29][29] = 1;
    return { g, s: [0, 0], t: [29, 29] };
  },
  'Салмақты 20x20 (құны 1..9, seed 5)': () => {
    const R = rng(5), g = makeGrid(20, 20);
    for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) g[r][c] = 1 + Math.floor(R() * 9);
    return { g, s: [0, 0], t: [19, 19] };
  },
};
for (const [name, mk] of Object.entries(scenarios)) {
  const { g, s, t } = mk(); out.search[name] = {};
  for (const a of ['bfs', 'dfs', 'ucs', 'astar']) {
    let r; const t0 = performance.now();
    for (let i = 0; i < REPS; i++) r = solve(a, g, s, t);
    out.search[name][a] = { found: r.found, cost: r.cost, expanded: r.expanded, ms: +((performance.now() - t0) / REPS).toFixed(3) };
  }
}

// --- Апта 3 ---
for (const n of [8, 12, 20]) {
  let solved = 0, restarts = 0, steps = 0; const RUNS = 50;
  for (let seed = 1; seed <= RUNS; seed++) {
    const r = hillClimbing(n, { maxRestarts: 100, seed });
    if (r.solved) { solved++; restarts += r.restarts; steps += r.steps.length - 1; }
  }
  // restarts=0 жағдайы (таза Hill Climbing)
  let plain = 0; for (let seed = 1; seed <= 200; seed++) if (hillClimbing(n, { maxRestarts: 0, seed }).solved) plain++;
  out.queens.push({ n, runs: RUNS, solved, avgRestarts: +(restarts / solved).toFixed(2), avgSteps: +(steps / solved).toFixed(1), plainSuccessPct: +(plain / 2).toFixed(1) });
}

// --- Апта 4 ---
const boards = { 'Бос тақта': Array(9).fill(null), 'X ортада': [null, null, null, null, 'X', null, null, null, null], 'X бұрышта': ['X', null, null, null, null, null, null, null, null] };
for (const [name, b] of Object.entries(boards)) {
  const player = 'O';
  let m, a; let t0 = performance.now();
  for (let i = 0; i < 20; i++) m = minimax([...b], player); const tm = (performance.now() - t0) / 20;
  t0 = performance.now(); for (let i = 0; i < 20; i++) a = alphaBeta([...b], player); const ta = (performance.now() - t0) / 20;
  out.ttt.push({ name, minimaxNodes: m.stats.nodes, alphaBetaNodes: a.stats.nodes, savedPct: +(100 * (1 - a.stats.nodes / m.stats.nodes)).toFixed(1), minimaxMs: +tm.toFixed(2), alphaBetaMs: +ta.toFixed(2), sameValue: m.value === a.value });
}
writeFileSync(new URL('../docs/benchmark-results.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
