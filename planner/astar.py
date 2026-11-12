"""Search: A* on a 4-connected grid towards the nearest of several exits."""
import heapq

MOVES = [(-1, 0), (1, 0), (0, -1), (0, 1)]  # up, down, left, right


def manhattan_to_nearest(cell, goals):
    """Admissible heuristic: Manhattan distance to the closest exit."""
    return min(abs(cell[0] - g[0]) + abs(cell[1] - g[1]) for g in goals)


def astar(grid, start, goals, blocked=()):
    """Find the cheapest path from start to any goal.

    grid    -- list of rows, 0 = wall, >= 1 = cost of entering the cell
    goals   -- list of (row, col) exits
    blocked -- extra cells treated as walls (used to plan a detour)

    Returns a dict with the path, its cost, the exit reached, the number of
    expanded nodes and a trace of (cell, g, h, f) in expansion order.
    Returns path=None when no exit is reachable.
    """
    rows, cols = len(grid), len(grid[0])
    blocked = set(blocked)

    def free(cell):
        r, c = cell
        return 0 <= r < rows and 0 <= c < cols and grid[r][c] > 0 and cell not in blocked

    if not free(start):
        raise ValueError("Start must be a free cell")
    goals = [g for g in goals if free(g)]
    if not goals:
        return {"path": None, "cost": None, "exit": None, "expanded": 0, "trace": []}

    seq = 0
    h0 = manhattan_to_nearest(start, goals)
    frontier = [(h0, h0, seq, start)]          # (f, h, insertion order, cell)
    g_cost = {start: 0}
    parent = {start: None}
    closed = set()
    trace = []

    while frontier:
        f, h, _, cell = heapq.heappop(frontier)
        if cell in closed:
            continue
        closed.add(cell)
        trace.append((cell, g_cost[cell], h, f))
        if cell in goals:
            path = []
            node = cell
            while node is not None:
                path.append(node)
                node = parent[node]
            path.reverse()
            return {"path": path, "cost": g_cost[cell], "exit": cell,
                    "expanded": len(trace), "trace": trace}
        for dr, dc in MOVES:
            nxt = (cell[0] + dr, cell[1] + dc)
            if not free(nxt) or nxt in closed:
                continue
            new_g = g_cost[cell] + grid[nxt[0]][nxt[1]]
            if new_g < g_cost.get(nxt, float("inf")):
                g_cost[nxt] = new_g
                parent[nxt] = cell
                nh = manhattan_to_nearest(nxt, goals)
                seq += 1
                heapq.heappush(frontier, (new_g + nh, nh, seq, nxt))

    return {"path": None, "cost": None, "exit": None, "expanded": len(trace), "trace": trace}
