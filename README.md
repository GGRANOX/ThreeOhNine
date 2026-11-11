# ThreeOhNine — AI Algorithm Visualizer

QAIRU AI Application Development Challenge 2026 (Final Project). An interactive web app that visualizes AI algorithms step by step and lets you change their parameters and compare the results. All algorithms are **written by hand**; no ready-made AI APIs are used.

## 3 AI topics implemented (syllabus weeks)
| Week | Topic | Algorithms | File |
|---|---|---|---|
| 2 | Uninformed Search, A*, Heuristics | BFS, DFS, UCS, A* (Manhattan/Euclidean/h=0) | `src/search.js` |
| 3 | Local Search | Hill Climbing + random restarts (N-Queens) | `src/localsearch.js` |
| 4 | Adversarial Search | Minimax, Alpha-Beta (Tic-Tac-Toe) | `src/adversarial.js` |

## Features
- **Search:** choose the grid size, draw walls and weights (5, 9), move the start and goal, pick the algorithm and heuristic, set the animation speed, compare all four algorithms in one table (cost, nodes expanded, time).
- **Hill Climbing:** N (4–30), restarts, seed; step-by-step playback with a slider and the number of conflicts h.
- **Minimax:** play against the AI, choose the AI algorithm, compare Minimax and Alpha-Beta node counts for every move.
- Invalid input handling: start on a wall, no path, invalid N, point outside the grid.

## Running
No dependencies (plain JavaScript, ES modules).
```bash
git clone https://github.com/GGRANOX/ThreeOhNine.git
cd ThreeOhNine
npx serve .        # or: python -m http.server 8000
```
Open `http://localhost:3000` (or `:8000`) in a browser. Opening `index.html` as a file does not work for ES modules — a server is required.

Live demo: https://threeohnine.vercel.app (preset states: `/?demo#search`, `#queens`, `#ttt`)

## Testing
Node.js ≥ 20:
```bash
npm test
```
Tests (`tests/algorithms.test.js`): optimality of BFS/UCS/A*, detour on a weighted grid, A* ≤ UCS in expanded nodes, no-path case, invalid input, correctness of the Hill Climbing solution, Alpha-Beta value = Minimax with fewer nodes, the AI never loses, the AI picks the winning move.

Metrics: path cost/length, nodes expanded, run time, number of conflicts, game nodes searched.

## Architecture
```
index.html, css/style.css, css/fonts.css, fonts/, img/logo.svg
src/search.js        # pure functions, independent of the UI
src/localsearch.js
src/adversarial.js
src/main.js          # UI: canvas, tabs, player
tests/               # node:test
docs/                # Technical Report, AI Usage Declaration, Team Contribution, slide outline
```
The algorithm logic is separated from the UI, so it is tested without a browser.

## Limitations
- Search runs on a 4-connected grid (no diagonals). BFS/DFS ignore weights.
- Hill Climbing can get stuck in a local minimum — restarts are used.
- Tic-Tac-Toe has a small game tree, so full Minimax is used (no depth limit).
- No secret API keys are used or needed.

## Documentation
`docs/technical-report.md` (with real measurements, `npm run bench`), `docs/ai-usage-declaration.md`, `docs/team-contribution.md`, `docs/presentation-outline.md`, presentation: `docs/ThreeOhNine-presentation.pptx`.

## Developers
Krasnobrizh Artyom, Orazgali Daulet
