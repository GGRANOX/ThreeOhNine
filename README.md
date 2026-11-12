# ThreeOhNine — Mini Emergency Exit Planner

QAIRU AI Fundamentals · Final Project 2026 · topic **05. Mini Emergency Exit Planner**

**Problem.** A fire alarm sounds in a small building. A person must reach an exit **fast**, but **without walking into smoke**. The fastest route runs through a corridor with a smoke sensor, and the sensor is noisy.

**Solution.** Three AI algorithms, one from each course group, work as **one pipeline** towards that common goal:

| # | Algorithm | Course group | Its job in the project | Output used by |
|---|---|---|---|---|
| 1 | **A\* search** | Search | Finds the fastest route to the nearest of two exits, and a detour that avoids the sensor corridor | MDP rewards (route lengths) |
| 2 | **Bayes’ rule** | Probabilistic reasoning | Turns one sensor reading into P(corridor blocked) | MDP belief |
| 3 | **MDP** (one Bellman update) | Sequential decision making | Chooses **Proceed** or **Detour** from the A\* costs and the Bayes probability | Final route |

```
map ──► A* ──► fastest route (5 steps) + detour (8 steps) ─┐
sensor ─► Bayes ──► P(blocked | alarm) = 0.60 ─────────────┼─► MDP ──► DETOUR → Exit A, 8 steps
                                                           ┘
```

All algorithms are written by hand; no AI API, trained model or real dataset is used. All numbers are labelled toy assumptions (`planner/scenario.py`).

## Inputs and assumptions
- Map: 6×6 grid, start S, **2 exits** (A, B), **3 walls**, **1 smoke sensor** in the corridor doorway C. Every move costs 1 step.
```
. . . . . A
. . # . # .
. . # . # .
S . C . . B
. . # . . .
. . # . . .
```
- Sensor model: prior P(blocked) = 0.20, P(alarm | blocked) = 0.90, P(alarm | clear) = 0.15.
- MDP: states {Clear, Blocked}, actions {Proceed, Detour}, γ = 0.9, smoke penalty = 20 steps. Rewards are negative steps taken from the A\* routes. Transition table T(s′|s,a) is in `planner/scenario.py`.

## Sample input / output
`python main.py alarm` (shortened):
```
1) A* SEARCH - route to the nearest exit
   Input : 6x6 map, start (3, 0), exits Exit A (0, 5), Exit B (3, 5), sensor corridor (3, 2)
   Steps : f = g + h, h = Manhattan distance to the nearest exit
           expand (3, 0)  g=0  h=5  f=5   ...   expand (3, 5)  g=5  h=0  f=5
   Output: fastest route to Exit B, 5 steps: (3,0) -> (3,1) -> (3,2) -> (3,3) -> (3,4) -> (3,5)
           detour avoiding (3, 2) to Exit A, 8 steps (12 cells expanded)
2) BAYESIAN INFERENCE - is the corridor blocked?
   Input : prior P(blocked) = 0.20, P(alarm|blocked) = 0.90, P(alarm|clear) = 0.15, reading = alarm
   Steps : 0.90 * 0.20 = 0.1800 ; 0.15 * 0.80 = 0.1200 ; P(o) = 0.3000
   Output: P(blocked | alarm) = 0.1800 / 0.3000 = 0.6000
3) MDP - Proceed or Detour?
   Input : R(Clear,Proceed) = -5, R(Blocked,Proceed) = -(2*2 + 8) - 20 = -32, R(.,Detour) = -8
   Steps : Q(Clear,Proceed) = -9.770  Q(Clear,Detour) = -12.635
           Q(Blocked,Proceed) = -39.200  Q(Blocked,Detour) = -12.635
           with b = 0.6000: Q(b,Proceed) = -27.428, Q(b,Detour) = -12.635
           decision threshold: detour when P(blocked) > 0.0973
   Output: Detour
FINAL PLAN: Detour -> Exit A in 8 steps
```
With **no alarm**: P(blocked) = 0.0286 → Q(Proceed) = −10.611 > Q(Detour) = −12.635 → **Proceed → Exit B in 5 steps**.

## Running
Python ≥ 3.9, standard library only:
```bash
python main.py            # console demo for both readings (or: alarm | clear)
python -m unittest discover -s tests -p "test_*.py" -v   # 18 Python tests
python scripts/evaluate.py                               # results below
```
Notebook: `ThreeOhNine.ipynb` (same steps, executed with outputs).

Web demo (optional, same logic ported to JavaScript): https://threeohnine.vercel.app — or locally `python -m http.server 8000` and open `http://localhost:8000`. `npm test` runs the JavaScript tests, including a check that the web version gives **exactly the same routes, probabilities and decisions as Python** on 60 random maps.

## Results
`python scripts/evaluate.py` — 100,000 simulated fire drills (seed 309):

| Policy | Avg. steps to exit | Walked into smoke |
|---|---|---|
| A\* only (always fastest route) | 6.41 | 20.1% |
| Always detour | 8.00 | 0.0% |
| A\* + MDP without the sensor (prior only) | 8.00 | 0.0% |
| **Full planner (A\* + Bayes + MDP)** | **6.04** | **2.0%** |

The full pipeline is both faster on average and ten times safer than following the shortest path. A\* expands 66% fewer cells than BFS on this map (4.5 vs 13.5 on average over all start cells).

## Algorithm Lab
The website also has an **Algorithm Lab** tab with the course demos: A\*/UCS/BFS/DFS comparison, Hill Climbing on N-Queens, and Minimax vs Alpha-Beta in Tic-Tac-Toe (`src/search.js`, `src/localsearch.js`, `src/adversarial.js`, measured with `npm run bench`).

## Project structure
```
planner/            Python core: scenario.py, astar.py, bayes.py, mdp.py, pipeline.py
main.py             console demo (input -> steps -> output -> why)
ThreeOhNine.ipynb   notebook with the same demo
scripts/evaluate.py results: policy comparison, sensitivity, search effort
tests/              test_planner.py (Python), *.test.js (web), fixtures/parity.json
index.html, css/, src/planner.js, src/planner-ui.js   web demo (Exit Planner tab)
src/search.js, localsearch.js, adversarial.js, main.js  Algorithm Lab tab
docs/               technical report, AI usage declaration, team contribution, presentation
```

## Limitations
- Toy model: one sensor, two corridor states, one Bellman update (as the project brief allows).
- The person can only learn the corridor state from the sensor or by reaching the corridor.
- Grid moves are 4-directional with equal cost.

## Documentation
`docs/technical-report.md`, `docs/ai-usage-declaration.md`, `docs/team-contribution.md`, `docs/presentation-outline.md`, presentation `docs/ThreeOhNine-presentation.pptx`, screenshots `docs/screenshots/`, evaluation data `docs/evaluation.json`.

## Developers
Krasnobrizh Artyom, Orazgali Daulet
