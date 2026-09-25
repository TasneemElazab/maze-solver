const { DIRECTIONS } = require("./solver");

// bfsSolve iteratively searches for the SHORTEST path from `start`
// to `end`, using an explicit queue instead of recursion.
// grid: array of arrays of characters.
// start, end: { row, col } objects.
// Returns an array of { row, col } positions from start to end
// (inclusive of both), or null if no path exists.
function bfsSolve(grid, start, end) {
    const numRows = grid.length;

    const visited = grid.map(row => row.map(() => false));
    const cameFrom = grid.map(row => row.map(() => null));

    // The queue is walked with a moving `head` index instead of
    // Array.prototype.shift(). shift() re-indexes the entire array on
    // every dequeue, which is O(frontier) work sitting inside the hot
    // loop; moving an index is O(1). The trade-off is that this array
    // keeps every cell we ever enqueued rather than releasing the ones
    // already processed — O(cells) memory, the same order as
    // `cameFrom`, which holds one entry per cell anyway.
    const queue = [start];
    let head = 0;
    visited[start.row][start.col] = true;

    while (head < queue.length) {
        const current = queue[head++];

        if (current.row === end.row && current.col === end.col) {
            return reconstructPath(cameFrom, current);
        }

        for (const { dr, dc } of DIRECTIONS) {
            const nr = current.row + dr;
            const nc = current.col + dc;

            if (nr < 0 || nr >= numRows || nc < 0 || nc >= grid[nr].length) continue;
            if (grid[nr][nc] === "#") continue;
            if (visited[nr][nc]) continue;

            visited[nr][nc] = true;
            cameFrom[nr][nc] = current;
            queue.push({ row: nr, col: nc });
        }
    }

    return null;
}

// Walk the cameFrom map backward from `end` to `start`, then
// reverse it, to turn "which cell did I arrive from" into an
// ordered start-to-end path.
//
// Note the push-then-reverse: unshift() has to re-index the array on
// every insertion, which makes building a length-L path O(L squared).
// push() is O(1) amortized, and a single reverse() at the end is O(L).
function reconstructPath(cameFrom, end) {
    const path = [];
    let node = end;
    while (node !== null) {
        path.push(node);
        node = cameFrom[node.row][node.col];
    }
    path.reverse();
    return path;
}

// bfsSolveMaze is the public entry point, mirroring solveMaze(maze) in
// solver.js so that index.js can swap between the two solvers without
// knowing anything about their internals. It takes the
// { grid, start, end } object that loadMaze() returns.
// Returns an ordered array of { row, col } cells from start to end
// (inclusive of both), or null if no path exists.
function bfsSolveMaze(maze) {
    return bfsSolve(maze.grid, maze.start, maze.end);
}

module.exports = { bfsSolveMaze, bfsSolve };
