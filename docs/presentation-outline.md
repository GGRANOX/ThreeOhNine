# Presentation (8 slides, ~5 min + live demo)

1. Title: ThreeOhNine — Mini Emergency Exit Planner.
2. Problem: the nearest exit may be full of smoke; the sensor is noisy.
3. Solution: one pipeline — A\* → Bayes → MDP → safe route; why each algorithm.
4. A\*: fastest route (Exit B, 5 steps) and detour (Exit A, 8 steps).
5. Bayes: P(blocked | alarm) = 0.60, P(blocked | no alarm) = 0.029.
6. MDP: rewards from A\*, one Bellman update, threshold 0.097 → Detour / Proceed.
7. Results: 100,000 simulated drills — 6.04 steps and 2% smoke vs 6.41 steps and 20% for A\* alone.
8. Testing, limitations, future work, demo link and team.

Live demo (1–2 min): website → Exit Planner → “Run step by step” with Alarm, then switch to No alarm; or `python main.py` in a terminal.
