"""Sequential decision making: a 2-state / 2-action MDP (Proceed vs Detour).

States:  Clear, Blocked   (condition of the corridor on the fastest route)
Actions: Proceed (take the fastest route), Detour (take the route that avoids
         the corridor)
Rewards are negative costs in steps, taken from the A* routes, so the MDP
directly uses the search result.
"""

STATES = ("Clear", "Blocked")
ACTIONS = ("Proceed", "Detour")


def build_rewards(main_len, detour_len, dist_to_corridor, smoke_penalty):
    """R(s, a) from the route lengths found by A*.

    Proceed + Clear   -> walk the fastest route.
    Proceed + Blocked -> walk to the corridor, find smoke, walk back and take
                         the detour, plus a penalty for smoke exposure.
    Detour            -> walk the detour route whatever the corridor state is.
    """
    return {
        ("Clear", "Proceed"): -main_len,
        ("Blocked", "Proceed"): -(2 * dist_to_corridor + detour_len) - smoke_penalty,
        ("Clear", "Detour"): -detour_len,
        ("Blocked", "Detour"): -detour_len,
    }


def bellman_update(rewards, transitions, gamma, belief_blocked):
    """One Bellman update, then choose the action with the higher value.

    V0(s)    = max_a R(s, a)                              (best one-step reward)
    Q(s, a)  = R(s, a) + gamma * sum_s' T(s'|s, a) V0(s')
    Q(b, a)  = (1 - b) Q(Clear, a) + b Q(Blocked, a)      (b = P(Blocked) from Bayes)
    """
    v0 = {s: max(rewards[(s, a)] for a in ACTIONS) for s in STATES}
    q = {}
    for s in STATES:
        for a in ACTIONS:
            future = sum(p * v0[s2] for s2, p in transitions[(s, a)].items())
            q[(s, a)] = rewards[(s, a)] + gamma * future
    belief = {"Clear": 1.0 - belief_blocked, "Blocked": belief_blocked}
    q_belief = {a: sum(belief[s] * q[(s, a)] for s in STATES) for a in ACTIONS}
    best = max(ACTIONS, key=lambda a: (q_belief[a], a == "Proceed"))

    # Belief at which both actions are equally good (decision threshold).
    dp = q[("Clear", "Proceed")] - q[("Clear", "Detour")]
    db = q[("Blocked", "Proceed")] - q[("Blocked", "Detour")]
    threshold = dp / (dp - db) if dp != db else None
    return {"v0": v0, "q": q, "q_belief": q_belief, "best": best, "threshold": threshold}
