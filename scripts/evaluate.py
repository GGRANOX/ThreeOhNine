"""Evaluation of the Emergency Exit Planner.

python scripts/evaluate.py  -> prints tables and writes docs/evaluation.json

1. Policy comparison: 100,000 simulated fire drills (seed 309).
2. Sensitivity: decision for different priors and sensor readings.
3. Search effort: A* vs BFS expanded cells from every free start cell.
"""
import json
import os
import random
import sys
from collections import deque

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

from planner import astar, plan, update_blocked  # noqa: E402
from planner import scenario as S  # noqa: E402

out = {}

# ---------- 1. Policy comparison (simulated drills) ----------
base_alarm, base_clear = plan(alarm=True), plan(alarm=False)
main_len, detour_len = base_alarm["main"]["cost"], base_alarm["detour"]["cost"]
dist = base_alarm["mdp"]["dist_to_corridor"]
turn_back_len = 2 * dist + detour_len  # walk in, find smoke, walk back, detour

policies = {
    "A* only (always fastest route)": lambda alarm: "Proceed",
    "Always detour": lambda alarm: "Detour",
    "A* + MDP, no sensor (prior only)": lambda alarm: base_alarm["mdp"]["best"] if S.PRIOR_BLOCKED > base_alarm["mdp"]["threshold"] else "Proceed",
    "Full planner (A* + Bayes + MDP)": lambda alarm: (base_alarm if alarm else base_clear)["decision"]["best"],
}
rng = random.Random(309)
N = 100_000
drills = []
for _ in range(N):
    blocked = rng.random() < S.PRIOR_BLOCKED
    alarm = rng.random() < (S.P_ALARM_IF_BLOCKED if blocked else S.P_ALARM_IF_CLEAR)
    drills.append((blocked, alarm))

out["policies"] = []
for name, policy in policies.items():
    steps = smoke = 0
    for blocked, alarm in drills:
        action = policy(alarm)
        if action == "Detour":
            steps += detour_len
        elif blocked:
            steps += turn_back_len
            smoke += 1
        else:
            steps += main_len
    out["policies"].append({"policy": name, "avg_steps": round(steps / N, 3), "smoke_pct": round(100 * smoke / N, 2)})

# ---------- 2. Sensitivity ----------
out["sensitivity"] = []
for prior in [0.05, 0.10, 0.20, 0.40]:
    row = {"prior": prior}
    for alarm in (True, False):
        r = plan(alarm=alarm, prior=prior)
        key = "alarm" if alarm else "no_alarm"
        row[key + "_posterior"] = round(r["bayes"]["posterior"], 4)
        row[key + "_decision"] = r["decision"]["best"]
    out["sensitivity"].append(row)
out["threshold"] = round(base_alarm["mdp"]["threshold"], 4)


# ---------- 3. Search effort: A* vs BFS ----------
def bfs_expanded(grid, start, goals):
    rows, cols = len(grid), len(grid[0])
    seen, queue, count = {start}, deque([start]), 0
    while queue:
        cell = queue.popleft()
        count += 1
        if cell in goals:
            return count
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            n = (cell[0] + dr, cell[1] + dc)
            if 0 <= n[0] < rows and 0 <= n[1] < cols and grid[n[0]][n[1]] and n not in seen:
                seen.add(n)
                queue.append(n)
    return count


grid, start, exits, sensor = S.parse_map()
goals = list(exits.values())
a_total = b_total = cells = 0
for r, row in enumerate(grid):
    for c, free in enumerate(row):
        if free and (r, c) not in goals:
            a_total += astar(grid, (r, c), goals)["expanded"]
            b_total += bfs_expanded(grid, (r, c), set(goals))
            cells += 1
out["search_effort"] = {
    "start_cells": cells,
    "astar_avg_expanded": round(a_total / cells, 2),
    "bfs_avg_expanded": round(b_total / cells, 2),
    "reduction_pct": round(100 * (1 - a_total / b_total), 1),
    "scenario_start": {"astar": base_alarm["main"]["expanded"], "bfs": bfs_expanded(grid, start, set(goals))},
}

with open(os.path.join(ROOT, "docs", "evaluation.json"), "w") as f:
    json.dump(out, f, indent=2)

print("Policy comparison (100,000 simulated drills)")
for p in out["policies"]:
    print(f"  {p['policy']:<36} avg steps {p['avg_steps']:>6}   walked into smoke {p['smoke_pct']:>5}%")
print(f"\nSensitivity (detour when P(blocked) > {out['threshold']})")
for s in out["sensitivity"]:
    print(f"  prior {s['prior']:.2f}: alarm -> {s['alarm_posterior']:.4f} {s['alarm_decision']:<8}"
          f" no alarm -> {s['no_alarm_posterior']:.4f} {s['no_alarm_decision']}")
e = out["search_effort"]
print(f"\nSearch effort over {e['start_cells']} start cells: A* {e['astar_avg_expanded']} vs BFS "
      f"{e['bfs_avg_expanded']} expanded cells on average ({e['reduction_pct']}% fewer); "
      f"scenario start: A* {e['scenario_start']['astar']} vs BFS {e['scenario_start']['bfs']}")
