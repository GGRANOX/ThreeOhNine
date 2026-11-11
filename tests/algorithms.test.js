import test from 'node:test';
import assert from 'node:assert/strict';
import { solve, makeGrid } from '../src/search.js';
import { hillClimbing, conflicts } from '../src/localsearch.js';
import { minimax, alphaBeta, aiMove, winner, isFull } from '../src/adversarial.js';

test('BFS/UCS/A* find the same optimal path on a uniform-cost grid', () => {
  const g = makeGrid(6, 6);
  for (let r = 0; r < 5; r++) g[r][3] = 0;
  for (const a of ['bfs', 'ucs', 'astar']) {
    const r = solve(a, g, [0, 0], [0, 5]);
    assert.ok(r.found);
    assert.equal(r.cost, 15);
  }
});

test('UCS/A* take the cheaper detour on a weighted grid', () => {
  const g = makeGrid(3, 3);
  g[0][1] = 9;
  assert.equal(solve('ucs', g, [0, 0], [0, 2]).cost, 4);
  assert.equal(solve('astar', g, [0, 0], [0, 2]).cost, 4);
  assert.ok(solve('bfs', g, [0, 0], [0, 2]).cost >= 4);
});

test('A* expands no more nodes than UCS', () => {
  const g = makeGrid(20, 20);
  const u = solve('ucs', g, [0, 0], [19, 19]), a = solve('astar', g, [0, 0], [19, 19]);
  assert.ok(a.expanded <= u.expanded);
  assert.equal(a.cost, u.cost);
});

test('found=false when there is no path', () => {
  const g = makeGrid(4, 4);
  for (let r = 0; r < 4; r++) g[r][2] = 0;
  for (const a of ['bfs', 'dfs', 'ucs', 'astar']) assert.equal(solve(a, g, [0, 0], [0, 3]).found, false);
});

test('invalid input: start on a wall, point outside the grid, size, algorithm', () => {
  const g = makeGrid(4, 4); g[0][0] = 0;
  assert.throws(() => solve('bfs', g, [0, 0], [3, 3]));
  assert.throws(() => solve('bfs', makeGrid(4, 4), [0, 0], [9, 9]));
  assert.throws(() => makeGrid(1, 5));
  assert.throws(() => solve('xyz', makeGrid(4, 4), [0, 0], [3, 3]));
});

test('Hill Climbing (with restarts) solves 8 queens', () => {
  const r = hillClimbing(8, { maxRestarts: 100, seed: 7 });
  assert.ok(r.solved);
  assert.equal(conflicts(r.state), 0);
  assert.equal(new Set(r.state).size, 8);
});

test('Hill Climbing rejects invalid parameters', () => {
  assert.throws(() => hillClimbing(2));
  assert.throws(() => hillClimbing(8.5));
  assert.throws(() => hillClimbing(8, { maxRestarts: -1 }));
});

test('Alpha-Beta returns the same value as Minimax with fewer nodes', () => {
  const b1 = Array(9).fill(null), b2 = Array(9).fill(null);
  b1[0] = 'X'; b2[0] = 'X';
  const m = minimax(b1, 'O'), a = alphaBeta(b2, 'O');
  assert.equal(m.value, a.value);
  assert.ok(a.stats.nodes < m.stats.nodes);
});

test('AI never loses (all replies of X)', () => {
  function safe(b) {
    if (winner(b) === 'X') return false;
    if (winner(b) || isFull(b)) return true;
    return b.every((v, i) => {
      if (v) return true;
      const c = [...b]; c[i] = 'X';
      if (winner(c) === 'X') return false;
      if (isFull(c)) return true;
      c[aiMove(c).move] = 'O';
      return safe(c);
    });
  }
  assert.ok(safe(Array(9).fill(null)));
});

test('AI picks the winning move when it has one', () => {
  assert.equal(aiMove(['O', 'O', null, 'X', 'X', null, null, null, null]).move, 2);
});

test('invalid board throws an error', () => {
  assert.throws(() => aiMove(['X', 'X', 'X', null, null, null, null, null, null]));
  assert.throws(() => aiMove([null]));
});
