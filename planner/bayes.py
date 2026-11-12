"""Probabilistic reasoning: Bayes' rule for one sensor observation."""


def update_blocked(prior, p_alarm_if_blocked, p_alarm_if_clear, alarm):
    """Posterior P(corridor blocked | sensor reading).

    P(B | o) = P(o | B) P(B) / [P(o | B) P(B) + P(o | not B) P(not B)]
    where o is "alarm" or "no alarm".
    """
    for name, p in [("prior", prior), ("P(alarm|blocked)", p_alarm_if_blocked),
                    ("P(alarm|clear)", p_alarm_if_clear)]:
        if not 0.0 <= p <= 1.0:
            raise ValueError(f"{name} must be between 0 and 1")

    like_blocked = p_alarm_if_blocked if alarm else 1.0 - p_alarm_if_blocked
    like_clear = p_alarm_if_clear if alarm else 1.0 - p_alarm_if_clear
    joint_blocked = like_blocked * prior
    joint_clear = like_clear * (1.0 - prior)
    evidence = joint_blocked + joint_clear
    if evidence == 0:
        raise ValueError("This observation is impossible under the model")
    posterior = joint_blocked / evidence
    return {
        "observation": "alarm" if alarm else "no alarm",
        "prior": prior,
        "likelihood_blocked": like_blocked,
        "likelihood_clear": like_clear,
        "joint_blocked": joint_blocked,
        "joint_clear": joint_clear,
        "evidence": evidence,
        "posterior": posterior,
    }
