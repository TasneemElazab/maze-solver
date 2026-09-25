const DIRECTIONS = [
    { dr: -1, dc: 0 },  // up
    { dr: 1, dc: 0 },   // down
    { dr: 0, dc: -1 },  // left
    { dr: 0, dc: 1 },   // right
];

// solve recursively searches for a path from `current` to `end`,
// pushing the cells of the walk onto the shared `path` array as it
// descends.
// grid: array of arrays of characters.
// visited: a 2D array of booleans, same dimensions as grid,
//          all false initially.
// path: a single shared array holding the cells of the walk being
//       tried, in order. The caller owns it and passes the same
//       array to every call.
// Returns true as soon as `end` is reached — with `path` then
// holding the complete route from the original start to `end` — or
// false if no route exists from `current`.
//
// Invariant: when a call returns false, both `visited` and `path`
// are exactly as they were before the call — a failed attempt
// leaves no trace. A call that returns true skips that cleanup,
// because the path itself is the answer. Prefer solveMaze(), which
// owns both arrays, so a successful (still-marked) `visited` can
// never be reused by mistake.
function solve(grid, visited, current, end, path) {
    const { row, col } = current;

    // Base case 1: out of bounds.
    // This line reads grid[row].length, which would crash if row
    // were invalid — but || stops at the first true, and the row
    // checks come before the col check. Order is not decoration.
    if (row < 0 || row >= grid.length || col < 0 || col >= grid[row].length) {
        return false;
    }

    // Base case 2: wall.
    if (grid[row][col] === "#") {
        return false;
    }

    // Base case 3: already visited on this path attempt.
    if (visited[row][col]) {
        return false;
    }

    // Mark this cell visited *before* recursing into neighbors,
    // so no neighbor's recursive call can walk back through it.
    // This is what prevents infinite loops in mazes with cycles:
    // every cell on the current call stack is marked, so the
    // recursion can never re-enter its own path.
    visited[row][col] = true;

    // Record this cell on the shared `path` as we descend. The
    // frames that unwind on success never pop, so by the time we
    // return to the top the array holds the whole route. Pushing
    // here — instead of copying the path with a spread on every
    // unwind — is what keeps the total cost O(path length) rather
    // than O(path length squared).
    path.push({ row, col });

    // Base case 4 (success): we've reached the end.
    if (row === end.row && col === end.col) {
        return true;
    }

    // Recursive case: try each direction from here.
    for (const { dr, dc } of DIRECTIONS) {
        const next = { row: row + dr, col: col + dc };

        if (solve(grid, visited, next, end, path)) {
            // A neighbor found a way to `end`. Returning true lets
            // every frame above keep this cell on the path too —
            // no list needs to be copied for that to happen.
            return true;
        }
    }

    // Every direction failed — this cell is a dead end. Backtrack:
    // un-mark it and drop it from the path, so that `visited` and
    // `path` reflect only the walk still being tried. Another route
    // may reach this cell later, and must be allowed to pass through.
    visited[row][col] = false;
    path.pop();

    return false;
}

// solveMaze is the public entry point, mirroring bfsSolveMaze(maze) in
// bfs-solver.js so that index.js can swap between the two solvers
// without knowing anything about their internals.
//
// It takes the { grid, start, end } object that loadMaze() returns and
// owns both scratch arrays itself. That removes two traps:
//   1. Callers no longer have to know that this solver needs a
//      pre-allocated `visited` grid while the BFS solver does not.
//   2. A successful search deliberately leaves `visited` fully marked
//      (see the invariant above). If a caller owned that array and
//      reused it for a second search, the second search would see every
//      cell as already visited and wrongly report "no path". Owning the
//      array here makes that impossible.
//
// Returns an ordered array of { row, col } cells from start to end
// (inclusive of both), or null if no path exists.
function solveMaze(maze) {
    const { grid, start, end } = maze;
    const visited = grid.map(row => row.map(() => false));
    const path = [];

    if (!solve(grid, visited, start, end, path)) {
        return null;
    }

    return path;
}

module.exports = { solveMaze, solve, DIRECTIONS };
