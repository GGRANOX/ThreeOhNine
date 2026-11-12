"""Scenario: Mini Emergency Exit Planner.

A person is inside a small building (a 6x6 grid) during a fire alarm and must
reach one of two exits. The fastest route goes through a corridor doorway that
has a smoke sensor. All numbers below are assumptions for a toy model
(no real dataset is used) and are labelled as such.

Grid legend used in MAP:
    S  start (the person)
    A  Exit A          B  Exit B
    C  corridor cell watched by the smoke sensor
    #  wall            .  free cell
"""

MAP = [
    ". . . . . A",
    ". . # . # .",
    ". . # . # .",
    "S . C . . B",
    ". . # . . .",
    ". . # . . .",
]

# --- Bayesian sensor model (assumptions) ---
PRIOR_BLOCKED = 0.20          # P(corridor blocked) before any reading
P_ALARM_IF_BLOCKED = 0.90     # sensor sensitivity: P(alarm | blocked)
P_ALARM_IF_CLEAR = 0.15       # false-alarm rate:   P(alarm | clear)

# --- MDP model (assumptions) ---
SMOKE_PENALTY = 20            # extra cost of walking into a smoke-filled corridor
GAMMA = 0.9                   # discount factor for the one Bellman update
# P(next corridor state | current state, action). Proceeding keeps you on the
# risky route; detouring moves you onto the other route, which is clear with
# probability 0.95 no matter what the corridor does.
TRANSITIONS = {
    ("Clear", "Proceed"):   {"Clear": 0.90, "Blocked": 0.10},
    ("Blocked", "Proceed"): {"Clear": 0.00, "Blocked": 1.00},
    ("Clear", "Detour"):    {"Clear": 0.95, "Blocked": 0.05},
    ("Blocked", "Detour"):  {"Clear": 0.95, "Blocked": 0.05},
}


def parse_map(rows=MAP):
    """Turn the text map into a grid (1 = free, 0 = wall) and named points."""
    grid, start, exits, sensor = [], None, {}, None
    for r, line in enumerate(rows):
        cells = line.split()
        row = []
        for c, ch in enumerate(cells):
            row.append(0 if ch == "#" else 1)
            if ch == "S":
                start = (r, c)
            elif ch in "AB":
                exits[f"Exit {ch}"] = (r, c)
            elif ch == "C":
                sensor = (r, c)
        grid.append(row)
    if start is None or not exits:
        raise ValueError("The map needs a start S and at least one exit")
    return grid, start, exits, sensor
