import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMap, astar, updateBlocked, buildRewards, bellmanUpdate, plan, SCENARIO } from '../src/planner.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('Planner (JS): fastest route is Exit B in 5 steps, detour is Exit A in 8 steps', () => {
  const m = parseMap();
  const main = astar(m.grid, m.start, Object.values(m.exits));
  const detour = astar(m.grid, m.start, Object.values(m.exits), [m.sensor]);
  assert.equal(main.cost, 5); assert.deepEqual(main.exit, m.exits['Exit B']);
  assert.equal(detour.cost, 8); assert.deepEqual(detour.exit, m.exits['Exit A']);
});

test('Planner (JS): Bayes posterior after alarm / no alarm', () => {
  close(updateBlocked(0.2, 0.9, 0.15, true).posterior, 0.6);
  close(updateBlocked(0.2, 0.9, 0.15, false).posterior, 0.02 / 0.7);
});

test('Planner (JS): MDP values and decision', () => {
  const m = bellmanUpdate(buildRewards(5, 8, 2, 20), SCENARIO.TRANSITIONS, 0.9, 0.6);
  close(m.q['Clear|Proceed'], -9.77); close(m.qBelief.Proceed, -27.428); close(m.qBelief.Detour, -12.635);
  assert.equal(m.best, 'Detour');
});

test('Planner (JS): whole pipeline for both sensor readings', () => {
  const a = plan(parseMap(), true), c = plan(parseMap(), false);
  assert.equal(a.decision.best, 'Detour'); assert.equal(a.routeExit, 'Exit A'); assert.equal(a.routeCost, 8);
  assert.equal(c.decision.best, 'Proceed'); assert.equal(c.routeExit, 'Exit B'); assert.equal(c.routeCost, 5);
});

test('Planner (JS): gives exactly the same results as the Python planner (60 random maps)', () => {
  const cases = JSON.parse(readFileSync(new URL('./fixtures/parity.json', import.meta.url)));
  assert.ok(cases.length >= 50);
  for (const k of cases) {
    const p = k.params;
    const r = plan(parseMap(k.rows), k.alarm, { prior: p.prior, pAlarmIfBlocked: p.p_alarm_if_blocked, pAlarmIfClear: p.p_alarm_if_clear, smokePenalty: p.smoke_penalty, gamma: p.gamma });
    assert.deepEqual(r.main.path, k.main_path);
    assert.equal(r.main.expanded, k.main_expanded);
    assert.deepEqual(r.detour.path, k.detour_path);
    close(r.bayes.posterior, k.posterior, 1e-12);
    if (k.q_belief) { close(r.mdp.qBelief.Proceed, k.q_belief.Proceed, 1e-9); close(r.mdp.qBelief.Detour, k.q_belief.Detour, 1e-9); }
    assert.equal(r.decision.best, k.best);
    assert.deepEqual(r.route, k.route);
  }
});
