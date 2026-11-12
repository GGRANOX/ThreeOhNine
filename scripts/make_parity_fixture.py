"""Writes tests/fixtures/parity.json: Python planner results for random maps.

The JavaScript test (tests/planner.test.js) checks that the website's port
gives exactly the same routes, probabilities, Q-values and decisions.
"""
import json
import os
import random
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)
from planner import astar, plan  # noqa: E402

rng = random.Random(309)
cases = []
while len(cases) < 60:
    cells = [["#" if rng.random() < 0.22 else "." for _ in range(6)] for _ in range(6)]
    free = [(r, c) for r in range(6) for c in range(6)]
    rng.shuffle(free)
    (sr, sc), (ar, ac), (br, bc), (cr, cc) = free[:4]
    cells[sr][sc], cells[ar][ac], cells[br][bc] = "S", "A", "B"
    grid = [[0 if ch == "#" else 1 for ch in row] for row in cells]
    route = astar(grid, (sr, sc), [(ar, ac), (br, bc)])["path"]
    if route and len(route) > 2 and rng.random() < 0.8:
        cr, cc = route[rng.randrange(1, len(route) - 1)]   # put the sensor on the fastest route
    cells[cr][cc] = "C"
    rows = [" ".join(row) for row in cells]
    params = {"prior": round(rng.uniform(0.02, 0.6), 2), "p_alarm_if_blocked": round(rng.uniform(0.6, 0.99), 2),
              "p_alarm_if_clear": round(rng.uniform(0.01, 0.4), 2), "smoke_penalty": rng.choice([0, 10, 20, 40]),
              "gamma": rng.choice([0.5, 0.9, 0.95])}
    alarm = rng.random() < 0.5
    try:
        r = plan(alarm, rows=rows, **params)
    except ValueError:
        continue
    cases.append({
        "rows": rows, "alarm": alarm, "params": params,
        "main_path": r["main"]["path"], "main_expanded": r["main"]["expanded"],
        "detour_path": r["detour"]["path"], "posterior": r["bayes"]["posterior"],
        "q_belief": r["mdp"]["q_belief"] if r["mdp"] else None,
        "best": r["decision"]["best"], "route": r["route"],
    })

os.makedirs(os.path.join(ROOT, "tests", "fixtures"), exist_ok=True)
with open(os.path.join(ROOT, "tests", "fixtures", "parity.json"), "w") as f:
    json.dump(cases, f)
print(len(cases), "cases,", sum(c["q_belief"] is not None for c in cases), "with an MDP decision,",
      sum(c["best"] == "Detour" for c in cases), "detours")
