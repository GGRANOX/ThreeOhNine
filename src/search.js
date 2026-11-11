// Week 2 — Uninformed Search, A*, Heuristics.
// cells[r][c] = 0 -> wall, >=1 -> cell cost (weight).
export const DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]];

export const HEURISTICS = {
  manhattan: (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]),
  euclidean: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]),
  zero: () => 0,
};

export function validateProblem(cells, start, goal) {
  if (!Array.isArray(cells) || !cells.length) throw new Error('Grid is empty');
  const R = cells.length, C = cells[0].length;
  for (const [n, p] of [['Start', start], ['Goal', goal]]) {
    if (!p || p[0] < 0 || p[1] < 0 || p[0] >= R || p[1] >= C) throw new Error(`${n} point is outside the grid`);
    if (cells[p[0]][p[1]] === 0) throw new Error(`${n} point is on a wall`);
  }
}

class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(item, key) {
    const a = this.a; a.push([key, item]); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top[1];
  }
}

/**
 * algo: 'bfs' | 'dfs' | 'ucs' | 'astar'
 * Returns: {found, path, visited, cost, expanded, ms}
 * visited — the order in which nodes were expanded (for visualization).
 */
export function solve(algo, cells, start, goal, heuristic = 'manhattan') {
  if (!['bfs', 'dfs', 'ucs', 'astar'].includes(algo)) throw new Error('Unknown algorithm: ' + algo);
  validateProblem(cells, start, goal);
  const h = HEURISTICS[heuristic];
  if (algo === 'astar' && !h) throw new Error('Unknown heuristic: ' + heuristic);
  const R = cells.length, C = cells[0].length;
  const id = (p) => p[0] * C + p[1];
  const priority = algo === 'ucs' || algo === 'astar';
  const t0 = performance.now();
  const g = new Map([[id(start), 0]]);
  const parent = new Map();
  const closed = new Set();
  const seen = new Set([id(start)]); // bfs/dfs
  const visited = [];
  const heap = priority ? new MinHeap() : null;
  const list = [];
  const push = (p) => {
    if (algo === 'ucs') heap.push(p, g.get(id(p)));
    else if (algo === 'astar') heap.push(p, g.get(id(p)) + h(p, goal));
    else list.push(p);
  };
  push(start);
  let found = false;
  while (priority ? heap.size : list.length) {
    const cur = priority ? heap.pop() : algo === 'bfs' ? list.shift() : list.pop();
    const cid = id(cur);
    if (priority) { if (closed.has(cid)) continue; closed.add(cid); }
    visited.push(cur);
    if (cid === id(goal)) { found = true; break; }
    for (const [dr, dc] of DIRS) {
      const nr = cur[0] + dr, nc = cur[1] + dc;
      if (nr < 0 || nc < 0 || nr >= R || nc >= C || cells[nr][nc] === 0) continue;
      const nid = nr * C + nc, np = [nr, nc];
      const ng = g.get(cid) + cells[nr][nc];
      if (!priority) {
        if (seen.has(nid)) continue;
        seen.add(nid); g.set(nid, ng); parent.set(nid, cid); push(np);
      } else if (!g.has(nid) || ng < g.get(nid)) {
        g.set(nid, ng); parent.set(nid, cid); push(np);
      }
    }
  }
  const path = [];
  if (found) {
    for (let c = id(goal); c !== undefined; c = parent.get(c)) path.push([Math.floor(c / C), c % C]);
    path.reverse();
  }
  const cost = found ? path.slice(1).reduce((s, p) => s + cells[p[0]][p[1]], 0) : null;
  return { found, path, visited, cost, expanded: visited.length, ms: performance.now() - t0 };
}

export function makeGrid(rows, cols, fill = 1) {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2 || rows > 60 || cols > 60)
    throw new Error('Grid size must be an integer between 2 and 60');
  return Array.from({ length: rows }, () => Array(cols).fill(fill));
}
