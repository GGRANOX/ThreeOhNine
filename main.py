"""Console demo: python main.py [alarm|clear|both]

Runs the Emergency Exit Planner and prints, for each algorithm,
input -> key steps -> output -> one-sentence explanation.
"""
import sys

from planner import plan, report


def main(argv):
    mode = argv[1] if len(argv) > 1 else "both"
    if mode not in ("alarm", "clear", "both"):
        print("usage: python main.py [alarm|clear|both]")
        return 2
    readings = {"alarm": [True], "clear": [False], "both": [True, False]}[mode]
    for alarm in readings:
        print(f"\n##### Sensor reading: {'ALARM (smoke detected)' if alarm else 'NO ALARM'} #####")
        print(report(plan(alarm)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
