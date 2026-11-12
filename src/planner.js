// Mini Emergency Exit Planner — JavaScript port of planner/*.py (same numbers).
// A* (search) -> Bayes (probabilistic reasoning) -> MDP (sequential decision).

export const SCENARIO = {
  MAP: [
    '. . . . . A',
    '. . # . # .',
    '. . # . # .',
    'S . C . . B',
    '. . # . . .',
    '. . # . . .',
  ],
  PRIOR_BLOCKED: 0.2,
  P_ALARM_IF_BLOCKED: 0.9,
  P_ALARM_IF_CLEAR: 0.15,
  SMOKE_PENALTY: 20,
  GAMMA: 0.9,
  TRANSITIONS: {
    'Clear|Proceed': { Clear: 0.9, Blocked: 0.1 },
    'Blocked|Proceed': { Clear: 0, Blocked: 1 },
    'Clear|Detour': { Clear: 0.95, Blocked: 0.05 },
    'Blocked|Detour': { Clear: 0.95, Blocked: 0.05 },
  },
};
export const STATES = ['Clear', 'Blocked'];
export const ACTIONS = ['Proceed', 'Detour'];
const key = (r, c) => r + ',' + c;

export function parseMap(rows = SCENARIO.MAP) {
  const grid = [], exits = {};
  let start = null, sensor = null;
  rows.forEach((line, r) => {
    grid.push(line.split(/\s+/).map((ch, c) => {
      if (ch === 'S') start = [r, c];
      else if (ch === 'A' || ch === 'B') exits['Exit ' + ch] = [r, c];
      else if (ch === 'C') sensor = [r, c];
      return ch === '#' ? 0 : 1;
    }));
  });
  if (!start || !Object.keys(exits).length) throw new Error('The map needs a start S and at least one exit');
  return { grid, start, exits, sensor };
}

export const manhattanToNearest = (cell, goals) => Math.min(...goals.map((g) => Math.abs(cell[0] - g[0]) + Math.abs(cell[1] - g[1])));

// Binary min-heap ordered by (f, h, seq) — the same order as Python's heapq tuples.
class Heap {
  constructor() { this.a = []; }
  less(x, y) { return x[0] !== y[0] ? x[0] < y[0] : x[1] !== y[1] ? x[1] < y[1] : x[2] < y[2]; }
  push(v) { const a = this.a; a.push(v); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (!this.less(a[i], a[p])) break; [a[i], a[p]] = [a[p], a[i]]; i = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && this.less(a[l], a[m])) m = l; if (r < a.length && this.less(a[r], a[m])) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } }
    return top;
  }
  get size() { return this.a.length; }
}

const MOVES = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function astar(grid, start, goals, blocked = []) {
  const R = grid.length, C = grid[0].length, block = new Set(blocked.filter(Boolean).map((p) => key(...p)));
  const free = ([r, c]) => r >= 0 && c >= 0 && r < R && c < C && grid[r][c] > 0 && !block.has(key(r, c));
  if (!free(start)) throw new Error('Start must be a free cell');
  goals = goals.filter(free);
  if (!goals.length) return { path: null, cost: null, exit: null, expanded: 0, trace: [] };
  const goalSet = new Set(goals.map((g) => key(...g)));
  let seq = 0;
  const h0 = manhattanToNearest(start, goals), heap = new Heap();
  heap.push([h0, h0, seq, start]);
  const g = new Map([[key(...start), 0]]), parent = new Map([[key(...start), null]]), closed = new Set(), trace = [];
  while (heap.size) {
    const [f, h, , cell] = heap.pop(), k = key(...cell);
    if (closed.has(k)) continue;
    closed.add(k);
    trace.push({ cell, g: g.get(k), h, f });
    if (goalSet.has(k)) {
      const path = [];
      for (let n = cell; n; n = parent.get(key(...n))) path.push(n);
      return { path: path.reverse(), cost: g.get(k), exit: cell, expanded: trace.length, trace };
    }
    for (const [dr, dc] of MOVES) {
      const nxt = [cell[0] + dr, cell[1] + dc], nk = key(...nxt);
      if (!free(nxt) || closed.has(nk)) continue;
      const ng = g.get(k) + grid[nxt[0]][nxt[1]];
      if (ng < (g.has(nk) ? g.get(nk) : Infinity)) {
        g.set(nk, ng); parent.set(nk, cell);
        const nh = manhattanToNearest(nxt, goals);
        heap.push([ng + nh, nh, ++seq, nxt]);
      }
    }
  }
  return { path: null, cost: null, exit: null, expanded: trace.length, trace };
}

export function updateBlocked(prior, pAlarmIfBlocked, pAlarmIfClear, alarm) {
  for (const [n, p] of [['prior', prior], ['P(alarm|blocked)', pAlarmIfBlocked], ['P(alarm|clear)', pAlarmIfClear]])
    if (!(p >= 0 && p <= 1)) throw new Error(n + ' must be between 0 and 1');
  const likeBlocked = alarm ? pAlarmIfBlocked : 1 - pAlarmIfBlocked;
  const likeClear = alarm ? pAlarmIfClear : 1 - pAlarmIfClear;
  const jointBlocked = likeBlocked * prior, jointClear = likeClear * (1 - prior), evidence = jointBlocked + jointClear;
  if (evidence === 0) throw new Error('This observation is impossible under the model');
  return { observation: alarm ? 'alarm' : 'no alarm', prior, likeBlocked, likeClear, jointBlocked, jointClear, evidence, posterior: jointBlocked / evidence };
}

export function buildRewards(mainLen, detourLen, distToCorridor, smokePenalty) {
  return {
    'Clear|Proceed': -mainLen,
    'Blocked|Proceed': -(2 * distToCorridor + detourLen) - smokePenalty,
    'Clear|Detour': -detourLen,
    'Blocked|Detour': -detourLen,
  };
}

export function bellmanUpdate(rewards, transitions, gamma, beliefBlocked) {
  const v0 = Object.fromEntries(STATES.map((s) => [s, Math.max(...ACTIONS.map((a) => rewards[s + '|' + a]))]));
  const q = {};
  for (const s of STATES) for (const a of ACTIONS) {
    const future = Object.entries(transitions[s + '|' + a]).reduce((sum, [s2, p]) => sum + p * v0[s2], 0);
    q[s + '|' + a] = rewards[s + '|' + a] + gamma * future;
  }
  const belief = { Clear: 1 - beliefBlocked, Blocked: beliefBlocked };
  const qBelief = Object.fromEntries(ACTIONS.map((a) => [a, STATES.reduce((sum, s) => sum + belief[s] * q[s + '|' + a], 0)]));
  const best = qBelief.Detour > qBelief.Proceed ? 'Detour' : 'Proceed';
  const dp = q['Clear|Proceed'] - q['Clear|Detour'], db = q['Blocked|Proceed'] - q['Blocked|Detour'];
  return { v0, q, qBelief, best, threshold: dp !== db ? dp / (dp - db) : null };
}

/** Runs A* -> Bayes -> MDP. `map` = {grid, start, exits, sensor}; `p` = parameters. */
export function plan(map, alarm, p = {}) {
  const prm = {
    prior: SCENARIO.PRIOR_BLOCKED, pAlarmIfBlocked: SCENARIO.P_ALARM_IF_BLOCKED, pAlarmIfClear: SCENARIO.P_ALARM_IF_CLEAR,
    smokePenalty: SCENARIO.SMOKE_PENALTY, gamma: SCENARIO.GAMMA, transitions: SCENARIO.TRANSITIONS, ...p,
  };
  const { grid, start, exits, sensor } = map, goals = Object.values(exits);
  const exitName = (cell) => Object.keys(exits).find((n) => exits[n][0] === cell[0] && exits[n][1] === cell[1]);
  const main = astar(grid, start, goals);
  if (!main.path) throw new Error('No exit can be reached from the start');
  const sensorIdx = sensor ? main.path.findIndex((c) => c[0] === sensor[0] && c[1] === sensor[1]) : -1;
  const onRoute = sensorIdx >= 0;
  const detour = onRoute ? astar(grid, start, goals, [sensor]) : main;
  const bayes = updateBlocked(prm.prior, prm.pAlarmIfBlocked, prm.pAlarmIfClear, alarm);
  let mdp = null, decision;
  if (!onRoute) decision = { best: 'Proceed', reason: 'The sensor corridor is not on the fastest route.' };
  else if (!detour.path) decision = { best: 'Proceed', reason: 'No detour exists, so the only option is to proceed.' };
  else {
    const rewards = buildRewards(main.cost, detour.cost, sensorIdx, prm.smokePenalty);
    mdp = { ...bellmanUpdate(rewards, prm.transitions, prm.gamma, bayes.posterior), rewards, distToCorridor: sensorIdx };
    decision = { best: mdp.best, reason: 'Higher expected value after one Bellman update.' };
  }
  const chosen = decision.best === 'Detour' ? detour : main;
  return {
    params: prm, grid, start, exits, sensor, main, detour, sensorOnRoute: onRoute, bayes, mdp, decision,
    route: chosen.path, routeExit: exitName(chosen.exit), routeCost: chosen.cost,
    mainExit: exitName(main.exit), detourExit: detour.path ? exitName(detour.exit) : null,
  };
}
