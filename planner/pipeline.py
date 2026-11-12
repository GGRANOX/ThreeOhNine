"""The full Emergency Exit Planner: A* -> Bayes -> MDP -> final route."""
from . import scenario as S
from .astar import astar
from .bayes import update_blocked
from .mdp import build_rewards, bellman_update


def plan(alarm, rows=S.MAP, prior=S.PRIOR_BLOCKED, p_alarm_if_blocked=S.P_ALARM_IF_BLOCKED,
         p_alarm_if_clear=S.P_ALARM_IF_CLEAR, smoke_penalty=S.SMOKE_PENALTY,
         gamma=S.GAMMA, transitions=S.TRANSITIONS):
    """Run the three algorithms in sequence for one sensor reading.

    1. A* finds the fastest route to the nearest exit, and a detour that
       avoids the sensor corridor (A* again with that cell blocked).
    2. Bayes turns the sensor reading into P(corridor blocked).
    3. The MDP compares Proceed and Detour with rewards taken from step 1 and
       the belief from step 2, and picks the safer action.
    """
    grid, start, exits, sensor = S.parse_map(rows)
    goals = list(exits.values())
    exit_name = {v: k for k, v in exits.items()}

    main = astar(grid, start, goals)
    if main["path"] is None:
        raise ValueError("No exit can be reached from the start")

    on_route = sensor is not None and sensor in main["path"]
    detour = astar(grid, start, goals, blocked=[sensor]) if on_route else main
    bayes = update_blocked(prior, p_alarm_if_blocked, p_alarm_if_clear, alarm)

    if not on_route:
        decision = {"best": "Proceed", "reason": "The sensor corridor is not on the fastest route."}
        mdp = None
    elif detour["path"] is None:
        decision = {"best": "Proceed", "reason": "No detour exists, so the only option is to proceed."}
        mdp = None
    else:
        dist = main["path"].index(sensor)
        rewards = build_rewards(main["cost"], detour["cost"], dist, smoke_penalty)
        mdp = bellman_update(rewards, transitions, gamma, bayes["posterior"])
        mdp["rewards"] = rewards
        mdp["dist_to_corridor"] = dist
        decision = {"best": mdp["best"], "reason": "Higher expected value after one Bellman update."}

    chosen = detour if decision["best"] == "Detour" else main
    return {
        "params": {"prior": prior, "p_alarm_if_blocked": p_alarm_if_blocked,
                   "p_alarm_if_clear": p_alarm_if_clear, "smoke_penalty": smoke_penalty, "gamma": gamma},
        "grid": grid, "start": start, "exits": exits, "sensor": sensor,
        "main": main, "detour": detour, "sensor_on_route": on_route,
        "bayes": bayes, "mdp": mdp, "decision": decision,
        "route": chosen["path"], "route_exit": exit_name[chosen["exit"]], "route_cost": chosen["cost"],
    }


def _cells(path):
    return " -> ".join(f"({r},{c})" for r, c in path)


def report(result):
    """Human-readable output: input -> key steps -> output -> why, per algorithm."""
    m, d, b, q = result["main"], result["detour"], result["bayes"], result["mdp"]
    ex = {v: k for k, v in result["exits"].items()}
    lines = []
    add = lines.append

    add("=" * 72)
    add("1) A* SEARCH - route to the nearest exit")
    add(f"   Input : 6x6 map, start {result['start']}, exits "
        + ", ".join(f"{k} {v}" for k, v in result["exits"].items())
        + f", sensor corridor {result['sensor']}")
    add("   Steps : f = g + h, h = Manhattan distance to the nearest exit")
    for cell, g, h, f in m["trace"]:
        add(f"           expand {cell}  g={g}  h={h}  f={f}")
    add(f"   Output: fastest route to {ex[m['exit']]}, {m['cost']} steps: {_cells(m['path'])}")
    if result["sensor_on_route"] and d["path"]:
        add(f"           detour avoiding {result['sensor']} to {ex[d['exit']]}, {d['cost']} steps "
            f"({d['expanded']} cells expanded): {_cells(d['path'])}")
    add("   Why   : A* is optimal with an admissible heuristic and expands fewer cells than blind search.")

    add("")
    add("2) BAYESIAN INFERENCE - is the corridor blocked?")
    pr = result["params"]
    add(f"   Input : prior P(blocked) = {b['prior']:.2f}, P(alarm|blocked) = {pr['p_alarm_if_blocked']:.2f}, "
        f"P(alarm|clear) = {pr['p_alarm_if_clear']:.2f}, reading = {b['observation']}")
    add(f"   Steps : P(o|blocked) * P(blocked) = {b['likelihood_blocked']:.2f} * {b['prior']:.2f} = {b['joint_blocked']:.4f}")
    add(f"           P(o|clear)   * P(clear)   = {b['likelihood_clear']:.2f} * {1 - b['prior']:.2f} = {b['joint_clear']:.4f}")
    add(f"           P(o) = {b['joint_blocked']:.4f} + {b['joint_clear']:.4f} = {b['evidence']:.4f}")
    add(f"   Output: P(blocked | {b['observation']}) = {b['joint_blocked']:.4f} / {b['evidence']:.4f} = {b['posterior']:.4f}")
    add("   Why   : Bayes' rule turns one noisy sensor reading into a probability the planner can use.")

    add("")
    add("3) MDP - Proceed or Detour?")
    if q is None:
        add(f"   Output: {result['decision']['best']} ({result['decision']['reason']})")
    else:
        r = q["rewards"]
        add(f"   Input : states {{Clear, Blocked}}, actions {{Proceed, Detour}}, gamma = {pr['gamma']}, "
            f"smoke penalty = {pr['smoke_penalty']}")
        add(f"           R(Clear,Proceed) = -{m['cost']}   R(Blocked,Proceed) = -(2*{q['dist_to_corridor']} + {d['cost']}) - {pr['smoke_penalty']} = {r[('Blocked','Proceed')]}")
        add(f"           R(Clear,Detour)  = -{d['cost']}   R(Blocked,Detour)  = -{d['cost']}")
        add(f"   Steps : V0(Clear) = {q['v0']['Clear']}, V0(Blocked) = {q['v0']['Blocked']}")
        for (s, a), val in q["q"].items():
            add(f"           Q({s},{a}) = {val:.3f}")
        add(f"           with b = P(blocked) = {b['posterior']:.4f}:")
        for a, val in q["q_belief"].items():
            add(f"           Q(b,{a}) = {val:.3f}")
        add(f"           decision threshold: detour when P(blocked) > {q['threshold']:.4f}")
        add(f"   Output: {q['best']}")
    add("   Why   : the MDP weighs the cost of each action in each corridor state by its probability.")

    add("")
    add("=" * 72)
    add(f"FINAL PLAN: {result['decision']['best']} -> {result['route_exit']} in {result['route_cost']} steps")
    add(f"           {_cells(result['route'])}")
    return "\n".join(lines)
