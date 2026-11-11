# Technical Report — ThreeOhNine

**Project:** ThreeOhNine — AI Algorithm Visualizer (QAIRU AI Application Development Challenge 2026, idea #5)
**Authors:** Krasnobrizh Artyom, Orazgali Daulet
**Live demo:** https://threeohnine.vercel.app · **GitHub:** https://github.com/GGRANOX/ThreeOhNine

## 1. Goal and problem
AI algorithms are hard to understand from a textbook: you can see the result, but not *how* the algorithm gets there. ThreeOhNine is an interactive web application that shows algorithms step by step and lets you change their parameters and compare their results. All algorithms are written by hand; no ready-made AI APIs are used.

The application covers topics from **three different weeks**:

| Week | Topic | Algorithms | File |
|---|---|---|---|
| 2 | Uninformed Search, A*, Heuristics | BFS, DFS, UCS, A* | `src/search.js` |
| 3 | Local Search | Hill Climbing + random restarts (N-Queens) | `src/localsearch.js` |
| 4 | Adversarial Search | Minimax, Alpha-Beta (Tic-Tac-Toe) | `src/adversarial.js` |

## 2. Architecture
Plain JavaScript (ES modules), no backend, no build step. The algorithm logic (`src/*.js`) is separated from the UI and written as pure functions, so it is tested in Node.js without a browser. `src/main.js` is the interface: canvas, tabs, animation. Hosting: Vercel (static site); source code: GitHub.

```
index.html, css/, fonts/, img/          # interface, design, fonts, logo
src/search.js | localsearch.js | adversarial.js   # algorithms
src/main.js                            # UI, animation, explanation panels
tests/algorithms.test.js               # 11 automated tests (node:test)
scripts/benchmark.mjs                  # measurement script -> docs/benchmark-results.json
```

Interface: dark emerald glassmorphism design with glowing neon edges, a custom “309” logo, Inter and JetBrains Mono fonts (stored in the repository), iOS-style sliders, SVG icons, `prefers-reduced-motion` support and a responsive layout for mobile screens.

## 3. Algorithms
### 3.1 Week 2 — Search: BFS, DFS, UCS, A*
- **Purpose:** find a path on a grid from the start point to the goal.
- **Input:** grid (0 = wall, ≥1 = cost of entering the cell), start, goal, algorithm, heuristic (Manhattan, Euclidean, h=0).
- **Output:** path, path cost, expansion order (for the animation), number of expanded nodes, run time.
- **Steps:** take a node from the frontier → goal test → expand the neighbours (4 directions) → update g and the parent. BFS uses a FIFO queue, DFS a stack, UCS a min-heap on g, A* a min-heap on f = g + h.
- **Limitations:** BFS ignores cell costs (it minimizes the number of steps); DFS does not guarantee an optimal path; the optimality of A* depends on an admissible heuristic — Manhattan and Euclidean are admissible on a 4-connected grid.

### 3.2 Week 3 — Local Search: Hill Climbing (N-Queens)
- **Input:** N, maximum number of restarts, seed. **Output:** the state at every step, h (number of conflicting pairs), solved / not solved.
- **Steps:** random state → move to the best (steepest-ascent) neighbour, i.e. move the queen that reduces h the most → stop if h does not decrease (local minimum) → random restart.
- **Limitations:** gets stuck in local minima and on plateaus; without enough restarts a solution is not guaranteed.

### 3.3 Week 4 — Adversarial Search: Minimax and Alpha-Beta (Tic-Tac-Toe)
- **Input:** board state, AI algorithm. **Output:** chosen move, its value, number of nodes searched.
- **Steps:** recursive search of the full game tree; terminal value for the AI is 10−depth (win), depth−10 (loss), 0 (draw); the AI maximizes, the human minimizes. Alpha-Beta prunes a branch when `beta ≤ alpha`.
- **Limitations:** a full-depth search is only feasible for 3×3; larger games need a depth limit and a heuristic evaluation.

## 4. Testing
`npm test` (Node.js `node:test`, 11 tests, all passing):

| # | Test | What it checks |
|---|---|---|
| 1 | BFS/UCS/A* on a uniform-cost grid | all three find the same optimal path cost (15) |
| 2 | UCS/A* on a weighted grid | they go around the expensive cell (cost 4) |
| 3 | A* ≤ UCS | A* expands no more nodes than UCS, with the same cost |
| 4 | No path | all 4 algorithms return `found=false` |
| 5 | Invalid input | start on a wall, point outside the grid, size, unknown algorithm |
| 6 | Hill Climbing | the found state has 0 conflicts, one queen per row |
| 7 | Hill Climbing invalid parameters | N < 4, fractional N, negative restarts |
| 8 | Alpha-Beta = Minimax | same value, fewer nodes |
| 9 | AI never loses | checks every possible reply of X |
| 10 | Winning move | the AI picks a one-move win |
| 11 | Invalid board | an error is thrown |

## 5. Results (real measurements)
Measured with `npm run bench` (`scripts/benchmark.mjs`), Node.js 24, Windows 11. Search time is the average of 100 runs, Minimax/Alpha-Beta the average of 20 runs. Full data: `docs/benchmark-results.json`. Times depend on the machine; node counts and costs are deterministic.

### 5.1 Search algorithms

**Open grid 30x30**

| Algorithm | Found | Path cost | Nodes expanded | Time, ms |
|---|---|---|---|---|
| BFS | yes | 58 | 900 | 0.81 |
| DFS | yes | 58 | 59 | 0.074 |
| UCS | yes | 58 | 900 | 0.801 |
| A* | yes | 58 | 116 | 0.141 |

**Maze 15x25 (two walls)**

| Algorithm | Found | Path cost | Nodes expanded | Time, ms |
|---|---|---|---|---|
| BFS | yes | 34 | 294 | 0.18 |
| DFS | yes | 114 | 259 | 0.213 |
| UCS | yes | 34 | 295 | 0.151 |
| A* | yes | 34 | 226 | 0.123 |

**Random 25% walls 30x30 (seed 2)**

| Algorithm | Found | Path cost | Nodes expanded | Time, ms |
|---|---|---|---|---|
| BFS | yes | 58 | 661 | 0.265 |
| DFS | yes | 154 | 231 | 0.104 |
| UCS | yes | 58 | 661 | 0.334 |
| A* | yes | 58 | 331 | 0.176 |

**Weighted 20x20 (cost 1..9, seed 5)**

| Algorithm | Found | Path cost | Nodes expanded | Time, ms |
|---|---|---|---|---|
| BFS | yes | 196 | 400 | 0.167 |
| DFS | yes | 196 | 39 | 0.02 |
| UCS | yes | 119 | 400 | 0.196 |
| A* | yes | 119 | 400 | 0.201 |

**Conclusions:**
- On uniform-cost grids BFS, UCS and A* always returned the optimal path cost. DFS found a path of cost 114 in the maze (3.4× the optimal 34) and 154 on the random grid (2.7× the optimal 58).
- A* expanded 23% fewer nodes than UCS in the maze (226 vs 295), 50% fewer on the random-walls grid (331 vs 661) and 87% fewer on the open grid (116 vs 900).
- On the weighted grid UCS and A* found cost 119, while BFS/DFS found 196 (65% more expensive) because they ignore cell costs. Here A* expanded 400 nodes, i.e. it had no advantage over UCS: the Manhattan heuristic is weak on a grid with weights 1..9, because it assumes every step has the cheapest cost (1).
- On the open grid DFS also found a path of cost 58 — not because it is optimal, but because its search order happened to match; in the maze and on the random grid DFS is clearly worse.

### 5.2 Hill Climbing (N-Queens)
| N | Runs | Solved (≤100 restarts) | Avg. restarts | Avg. steps | Success without restarts (200 runs) |
|---|---|---|---|---|---|
| 8 | 50 | 50/50 | 4.94 | 24.1 | 16.5% |
| 12 | 50 | 49/50 | 19.24 | 118.4 | 4.5% |
| 20 | 50 | 45/50 | 22.62 | 223.4 | 2% |

**Conclusions:** without restarts Hill Climbing solves the problem less and less often as N grows (N=8: 16.5%; N=20: 2%). With restarts (≤100) a solution was found in 50/50 cases for N=8, 49/50 for N=12 and 45/50 for N=20. The average number of steps grows with N (24 → 223).

### 5.3 Minimax and Alpha-Beta (Tic-Tac-Toe)
| Initial state | Minimax nodes | Alpha-Beta nodes | Saved | Minimax, ms | Alpha-Beta, ms | Same value |
|---|---|---|---|---|---|---|
| Empty board | 549,946 | 20,866 | 96.2% | 126.63 | 5.79 | yes |
| X in the center | 55,505 | 2,459 | 95.6% | 13.23 | 0.76 | yes |
| X in a corner | 59,705 | 2,788 | 95.3% | 14.28 | 0.68 | yes |

**Conclusions:** Alpha-Beta returns the same value as Minimax but prunes ~95–96% of the nodes and is roughly 17–22× faster (in this measurement). On an empty board with the AI moving first, Minimax searches 549,946 nodes.

### 5.4 Screenshots
Files: `docs/screenshots/search.png` (A* and the comparison table), `docs/screenshots/queens.png` (Hill Climbing), `docs/screenshots/ttt.png` (Minimax). To open exactly these states: https://threeohnine.vercel.app/?demo#search (or `#queens`, `#ttt`).

## 6. Limitations and future work
- The grid is 4-connected (no diagonals); all cell costs are positive.
- Hill Climbing does not guarantee a solution for large N.
- Tic-Tac-Toe uses the full game tree with no depth limit.
- The interface has not been tested extensively by hand on mobile devices (the layout is responsive).
- Future work: highlighting the current A* pseudocode line, visualizing the Minimax tree, Q-learning (week 5).

## 7. Conclusion
AI methods from three different weeks (2, 3, 4) were implemented by hand, verified with automated tests and shown interactively. The measurements confirm the expected properties: A* expands fewer nodes than UCS, Alpha-Beta gives the same result as Minimax with far less computation, and random restarts sharply increase the success rate of Hill Climbing.

## 8. References
- Russell, S., Norvig, P. *Artificial Intelligence: A Modern Approach* (4th ed.), Ch. 3–5.
- QAIRU AI Fundamentals course materials and the Final Project brief (2026).
