"""Python tests: python -m unittest discover -s tests -p "test_*.py" -v"""
import os
import random
import sys
import unittest
from collections import deque

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from planner import astar, bellman_update, build_rewards, manhattan_to_nearest, plan, update_blocked  # noqa: E402
from planner import scenario as S  # noqa: E402


def bfs_distance(grid, start, goals):
    """Reference shortest number of steps (all cells cost 1)."""
    rows, cols = len(grid), len(grid[0])
    seen, queue = {start: 0}, deque([start])
    while queue:
        cell = queue.popleft()
        if cell in goals:
            return seen[cell]
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            n = (cell[0] + dr, cell[1] + dc)
            if 0 <= n[0] < rows and 0 <= n[1] < cols and grid[n[0]][n[1]] and n not in seen:
                seen[n] = seen[cell] + 1
                queue.append(n)
    return None


class TestAStar(unittest.TestCase):
    def setUp(self):
        self.grid, self.start, self.exits, self.sensor = S.parse_map()
        self.goals = list(self.exits.values())

    def test_fastest_route_goes_to_exit_b_through_corridor(self):
        r = astar(self.grid, self.start, self.goals)
        self.assertEqual(r["cost"], 5)
        self.assertEqual(r["exit"], self.exits["Exit B"])
        self.assertIn(self.sensor, r["path"])

    def test_detour_avoids_corridor_and_reaches_exit_a(self):
        r = astar(self.grid, self.start, self.goals, blocked=[self.sensor])
        self.assertEqual(r["cost"], 8)
        self.assertEqual(r["exit"], self.exits["Exit A"])
        self.assertNotIn(self.sensor, r["path"])

    def test_path_is_connected_and_avoids_walls(self):
        r = astar(self.grid, self.start, self.goals)
        for (r1, c1), (r2, c2) in zip(r["path"], r["path"][1:]):
            self.assertEqual(abs(r1 - r2) + abs(c1 - c2), 1)
            self.assertEqual(self.grid[r2][c2], 1)

    def test_no_route_returns_none(self):
        grid = [[1, 0, 1], [1, 0, 1], [1, 0, 1]]
        r = astar(grid, (0, 0), [(2, 2)])
        self.assertIsNone(r["path"])

    def test_start_on_wall_is_rejected(self):
        with self.assertRaises(ValueError):
            astar([[0, 1]], (0, 0), [(0, 1)])

    def test_heuristic_is_admissible_on_the_map(self):
        for r, row in enumerate(self.grid):
            for c, free in enumerate(row):
                if free:
                    true = bfs_distance(self.grid, (r, c), set(self.goals))
                    self.assertLessEqual(manhattan_to_nearest((r, c), self.goals), true)

    def test_matches_bfs_on_random_grids(self):
        rng = random.Random(309)
        for _ in range(200):
            grid = [[0 if rng.random() < 0.25 else 1 for _ in range(6)] for _ in range(6)]
            grid[0][0] = grid[5][5] = grid[0][5] = 1
            goals = [(5, 5), (0, 5)]
            r = astar(grid, (0, 0), goals)
            self.assertEqual(r["cost"], bfs_distance(grid, (0, 0), set(goals)))


class TestBayes(unittest.TestCase):
    def test_alarm_raises_probability(self):
        b = update_blocked(0.2, 0.9, 0.15, alarm=True)
        self.assertAlmostEqual(b["evidence"], 0.30)
        self.assertAlmostEqual(b["posterior"], 0.60)

    def test_no_alarm_lowers_probability(self):
        b = update_blocked(0.2, 0.9, 0.15, alarm=False)
        self.assertAlmostEqual(b["posterior"], 0.02 / 0.70)

    def test_useless_sensor_keeps_prior(self):
        self.assertAlmostEqual(update_blocked(0.3, 0.5, 0.5, alarm=True)["posterior"], 0.3)

    def test_invalid_probability_is_rejected(self):
        with self.assertRaises(ValueError):
            update_blocked(1.5, 0.9, 0.15, alarm=True)


class TestMDP(unittest.TestCase):
    def setUp(self):
        self.rewards = build_rewards(main_len=5, detour_len=8, dist_to_corridor=2, smoke_penalty=20)

    def test_rewards_come_from_route_lengths(self):
        self.assertEqual(self.rewards[("Clear", "Proceed")], -5)
        self.assertEqual(self.rewards[("Blocked", "Proceed")], -32)
        self.assertEqual(self.rewards[("Clear", "Detour")], -8)

    def test_bellman_update_values(self):
        m = bellman_update(self.rewards, S.TRANSITIONS, 0.9, belief_blocked=0.6)
        self.assertAlmostEqual(m["q"][("Clear", "Proceed")], -9.77)
        self.assertAlmostEqual(m["q"][("Blocked", "Proceed")], -39.2)
        self.assertAlmostEqual(m["q"][("Clear", "Detour")], -12.635)
        self.assertAlmostEqual(m["q_belief"]["Proceed"], -27.428)
        self.assertEqual(m["best"], "Detour")

    def test_decision_flips_at_threshold(self):
        t = bellman_update(self.rewards, S.TRANSITIONS, 0.9, 0.0)["threshold"]
        self.assertAlmostEqual(t, 2.865 / 29.43, places=6)
        self.assertEqual(bellman_update(self.rewards, S.TRANSITIONS, 0.9, t - 0.01)["best"], "Proceed")
        self.assertEqual(bellman_update(self.rewards, S.TRANSITIONS, 0.9, t + 0.01)["best"], "Detour")


class TestPipeline(unittest.TestCase):
    def test_alarm_leads_to_detour_via_exit_a(self):
        r = plan(alarm=True)
        self.assertEqual(r["decision"]["best"], "Detour")
        self.assertEqual((r["route_exit"], r["route_cost"]), ("Exit A", 8))
        self.assertNotIn(r["sensor"], r["route"])

    def test_no_alarm_leads_to_fastest_route_via_exit_b(self):
        r = plan(alarm=False)
        self.assertEqual(r["decision"]["best"], "Proceed")
        self.assertEqual((r["route_exit"], r["route_cost"]), ("Exit B", 5))

    def test_sensor_off_route_is_ignored(self):
        rows = [row.replace("C", ".") for row in S.MAP]
        rows[0] = "C . . . . A"
        r = plan(alarm=True, rows=rows)
        self.assertFalse(r["sensor_on_route"])
        self.assertEqual(r["decision"]["best"], "Proceed")

    def test_no_detour_means_proceed(self):
        rows = [". . # . . A", ". . # . . .", ". . # . . .", "S . C . . B", ". . # . . .", ". . # . . ."]
        r = plan(alarm=True, rows=rows)
        self.assertIsNone(r["detour"]["path"])
        self.assertEqual(r["decision"]["best"], "Proceed")


if __name__ == "__main__":
    unittest.main()
