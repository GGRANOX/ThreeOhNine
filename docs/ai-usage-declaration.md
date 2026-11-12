# AI Usage Declaration

**Project:** ThreeOhNine — Mini Emergency Exit Planner
**Authors:** Krasnobrizh Artyom, Orazgali Daulet

## AI tools used
- **Claude (Anthropic) — Claude Code and Claude Cowork**: project planning, the first version of the code (Python planner, web demo, Algorithm Lab) and of the automated tests, interface design (the emerald glass theme and the “309” logo), documentation, the presentation and the speech, the English translation, and publishing the work to GitHub and Vercel.
- **UI/UX Pro Max** (a Claude Code design guide): help with choosing design directions.

## AI-assisted code
All files in `planner/`, `src/`, `tests/` and `scripts/` were written with AI assistance. The authors ran and reviewed them and can explain them. The key formulas (A\* f = g + h, Bayes’ rule, the Bellman update) are checked by hand in the technical report and by the tests.

## No AI APIs inside the application
The application’s algorithms (A\*, Bayes’ rule, the MDP; in the Algorithm Lab also BFS, DFS, UCS, Hill Climbing, Minimax and Alpha-Beta) are written by hand in Python and JavaScript. No ready-made AI API, pre-trained model or secret key is used.

## Authors’ responsibility
The authors have read, run and tested the code (`python -m unittest`, 18 tests; `npm test`, 16 tests) and can explain how each algorithm works. The authors have reviewed the AI-assisted materials and take responsibility for them.

| Author | Confirmation |
|---|---|
| Krasnobrizh Artyom | I agree with the information above |
| Orazgali Daulet | I agree with the information above |
