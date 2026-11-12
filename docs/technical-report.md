# Technical Report — ThreeOhNine: Mini Emergency Exit Planner

**Course:** AI Fundamentals — Final Project 2026 (topic 05, Mini Emergency Exit Planner)
**Authors:** Krasnobrizh Artyom, Orazgali Daulet
**Live demo:** https://threeohnine.vercel.app · **GitHub:** https://github.com/GGRANOX/ThreeOhNine

## 1. Problem
When a fire alarm sounds, people head for the nearest exit. The nearest exit is not always the safest: a corridor on the way may already be full of smoke. A smoke sensor can warn about it, but sensors give false alarms and sometimes miss smoke. The planner has to answer one practical question: **which way should this person go right now?** It has to balance speed (fewer steps) against safety (not walking into smoke).

## 2. Solution: one pipeline, three algorithms
The three algorithms come from the three groups required by the brief. Each one solves the part of the problem it is best at and hands its result to the next.

| Step | Algorithm (group) | Subproblem | Why this algorithm fits |
|---|---|---|---|
| 1 | A\* (search) | Where are the exits and how far are they? | Finds the shortest route on a map, provably optimal with an admissible heuristic, and expands few cells |
| 2 | Bayes’ rule (probabilistic reasoning) | How likely is the corridor to be blocked after this sensor reading? | Combines a prior with a noisy observation into a calibrated probability |
| 3 | MDP (sequential decision making) | Should the person proceed or detour? | Chooses the action with the best expected outcome under uncertainty, using rewards and state probabilities |

Data flow: A\* → route lengths → **MDP rewards**; Bayes → P(blocked) → **MDP belief**; MDP → action → the A\* route that is followed. None of the three alone solves the problem: A\* alone always walks into the corridor, Bayes alone gives a number but no route, and the MDP needs both.

## 3. Inputs and assumptions
Toy values, as allowed by the brief (no real dataset or trained model). All of them live in `planner/scenario.py`.

```
. . . . . A      S = start (3,0)       A = Exit A (0,5)    B = Exit B (3,5)
. . # . # .      C = corridor doorway with the smoke sensor (3,2)
. . # . # .      # = wall (3 wall segments)
S . C . . B
. . # . . .
. . # . . .
```
- Every move costs 1 step; moves are up, down, left, right.
- Sensor: prior P(blocked) = 0.20; P(alarm | blocked) = 0.90 (sensitivity); P(alarm | clear) = 0.15 (false-alarm rate).
- MDP: states {Clear, Blocked}; actions {Proceed, Detour}; discount γ = 0.9; smoke penalty = 20 steps.
- Transitions T(s′ | s, a): Proceed — Clear→Clear 0.90, Clear→Blocked 0.10, Blocked→Blocked 1.00; Detour — moves the person to a route that is clear with probability 0.95 from either state.

## 4. Algorithms: input → key steps → output
### 4.1 A\* search (`planner/astar.py`)
- **Input:** grid, start, the two exits, optional cells to treat as walls.
- **Key steps:** keep a priority queue ordered by f = g + h, where g is the number of steps so far and h is the Manhattan distance to the **nearest** exit. Pop the lowest f, stop at an exit, otherwise expand the 4 neighbours. Ties are broken by lower h, then by insertion order, so results are reproducible. The heuristic is admissible: every step costs at least 1 and moves are 4-directional, so Manhattan distance never overestimates.
- **Output:** fastest route **Exit B, 5 steps**, through C (6 cells expanded). A\* is then run again with C treated as a wall, which gives the detour **Exit A, 8 steps** (12 cells expanded).
- **Contribution:** the two route lengths and the distance to the corridor (2 steps) become the MDP rewards.

### 4.2 Bayesian inference (`planner/bayes.py`)
- **Input:** prior P(B) = 0.20, sensor model, one reading o ∈ {alarm, no alarm}.
- **Key steps:** P(B | o) = P(o | B)·P(B) / [P(o | B)·P(B) + P(o | ¬B)·P(¬B)].
  - Alarm: 0.90·0.20 = 0.18; 0.15·0.80 = 0.12; P(o) = 0.30 → **P(B | alarm) = 0.60**.
  - No alarm: 0.10·0.20 = 0.02; 0.85·0.80 = 0.68; P(o) = 0.70 → **P(B | no alarm) = 0.0286**.
- **Output:** the posterior probability that the corridor is blocked.
- **Contribution:** it is the MDP’s belief over its two states.

### 4.3 MDP decision (`planner/mdp.py`)
- **Input:** rewards from A\* (negative steps):

| R(s, a) | Proceed | Detour |
|---|---|---|
| Clear | −5 (fastest route) | −8 (detour) |
| Blocked | −(2·2 + 8) − 20 = −32 (walk to the smoke, back, detour, penalty) | −8 |

- **Key steps:** one Bellman update, as the brief suggests: V₀(s) = maxₐ R(s, a); Q(s, a) = R(s, a) + γ Σ T(s′ | s, a) V₀(s′). Then the belief from Bayes is applied: Q(b, a) = (1 − b)·Q(Clear, a) + b·Q(Blocked, a).

| Q(s, a) | Proceed | Detour |
|---|---|---|
| Clear | −9.770 | −12.635 |
| Blocked | −39.200 | −12.635 |
| b = 0.60 (alarm) | **−27.428** | **−12.635** → Detour |
| b = 0.0286 (no alarm) | **−10.611** | **−12.635** → Proceed |

- **Output:** the action with the higher value. The two lines cross at **P(blocked) = 0.0973**, the decision threshold: detour whenever the corridor is more than about 10% likely to be blocked.
- **Contribution:** it turns a route and a probability into one recommendation, with an explicit trade-off between 3 extra steps and the risk of smoke.

### 4.4 Final plan (`planner/pipeline.py`)
- Alarm: **Detour → Exit A in 8 steps**: (3,0) → (3,1) → (2,1) → (1,1) → (0,1) → (0,2) → (0,3) → (0,4) → (0,5).
- No alarm: **Proceed → Exit B in 5 steps**: (3,0) → (3,1) → (3,2) → (3,3) → (3,4) → (3,5).
- Edge cases: if the sensor is not on the fastest route, the planner proceeds; if no detour exists, it proceeds; if no exit is reachable, it reports an error.

## 5. Implementation
- **Python core** (`planner/`, standard library only), with `main.py` as a console demo and `ThreeOhNine.ipynb` as a notebook. Each algorithm prints input → key steps → output → one-sentence explanation.
- **Web demo** (optional): the same logic ported to JavaScript (`src/planner.js`), with an interactive map, sliders for every assumption and a step-by-step animation of the pipeline (`src/planner-ui.js`). It is deployed on Vercel.
- **Parity:** `tests/fixtures/parity.json` holds Python results for 60 random maps and parameters. The JavaScript test checks that the website gives exactly the same paths, probabilities, Q-values and decisions.

## 6. Testing
`python -m unittest discover -s tests -p "test_*.py"` — 18 tests, all passing:
- **A\*:** fastest route = Exit B in 5 steps; detour = Exit A in 8 steps and avoids C; the path is connected and avoids walls; no route → `None`; start on a wall → error; the heuristic is admissible on every free cell; the cost equals the BFS shortest path on 200 random grids.
- **Bayes:** alarm → 0.60; no alarm → 0.02/0.70; a useless sensor (equal likelihoods) keeps the prior; invalid probabilities are rejected.
- **MDP:** rewards come from route lengths; Q-values match the hand calculation; the decision flips exactly at the threshold.
- **Pipeline:** alarm → Detour via Exit A; no alarm → Proceed via Exit B; sensor off route → Proceed; no detour → Proceed.

`npm test` — 16 JavaScript tests: 5 for the planner (including parity with Python) and 11 for the Algorithm Lab.

## 7. Results and evaluation
`python scripts/evaluate.py` (full data in `docs/evaluation.json`).

**Policy comparison**, 100,000 simulated fire drills (seed 309). In each drill the corridor is blocked with probability 0.20 and the sensor reacts according to its model:

| Policy | Avg. steps to an exit | Drills where the person walked into smoke |
|---|---|---|
| A\* only (always the fastest route) | 6.41 | 20.1% |
| Always detour | 8.00 | 0.0% |
| A\* + MDP without the sensor (prior only) | 8.00 | 0.0% |
| **Full planner: A\* + Bayes + MDP** | **6.04** | **2.0%** |

- The full pipeline is the best trade-off. It is faster on average than always taking the shortest path (6.04 vs 6.41 steps), because turning back from smoke is expensive. It also walks into smoke ten times less often (2.0% vs 20.1%).
- The sensor is what makes the difference: without it, the MDP has to detour every time (8 steps). The remaining 2% are drills where the corridor was blocked and the sensor missed it (0.20 × 0.10).

**Sensitivity** (threshold 0.0973):

| Prior P(blocked) | After alarm | Decision | After no alarm | Decision |
|---|---|---|---|---|
| 0.05 | 0.240 | Detour | 0.006 | Proceed |
| 0.10 | 0.400 | Detour | 0.013 | Proceed |
| 0.20 | 0.600 | Detour | 0.029 | Proceed |
| 0.40 | 0.800 | Detour | 0.073 | Proceed |

For priors from 0.05 to 0.40 the decision follows the sensor, which is the intended behaviour of a good sensor model.

**Search effort:** over all 28 free start cells, A\* expands on average 4.5 cells and BFS 13.5 (66% fewer). From the scenario start: A\* expands 6 cells, BFS 22.

## 8. Limitations and future work
- One sensor, two corridor states and a single Bellman update keep the model small, as the brief requires. A full value iteration over a multi-step evacuation would be the next step.
- The person only learns the corridor state from the sensor or by reaching it. Several sensors could be combined with naive Bayes or an HMM over time.
- Uniform move costs; smoke spreading over time could be added as changing edge costs (re-planning with A\* or D\* Lite).
- Future development: real floor plans, several people (crowding), and a mobile app that reads building sensors.

## 9. Appendix: Algorithm Lab
The website also has an **Algorithm Lab** tab with three course demos that are separate from the main project: A\*/UCS/BFS/DFS comparison on large grids, Hill Climbing with random restarts on N-Queens, and Minimax vs Alpha-Beta in Tic-Tac-Toe (`src/search.js`, `src/localsearch.js`, `src/adversarial.js`; measurements in `docs/benchmark-results.json`, `npm run bench`). For example, on an empty Tic-Tac-Toe board Alpha-Beta searches 20,866 nodes instead of 549,946 with the same result.

## 10. References
- Russell, S., Norvig, P. *Artificial Intelligence: A Modern Approach* (4th ed.): Ch. 3 (A\*), Ch. 12–13 (Bayes’ rule), Ch. 17 (MDPs).
- QAIRU AI Fundamentals course materials, Final Project brief and the Final Project topic list (2026).
