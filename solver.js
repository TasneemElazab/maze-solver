const DIRECTIONS = [
    { dr: -1, dc: 0 },  // up
    { dr: 1, dc: 0 },   // down
    { dr: 0, dc: -1 },  // left
    { dr: 0, dc: 1 },   // right
];

function solve(grid, visited, current, end, path) {
    const { row, col } = current;

    // Base case 1: out of bounds.
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

    // Mark this cell visited *before* recursing into neighbors,so no neighbor's recursive call can walk back through it (prevent infinite loop)
    visited[row][col] = true;

    
    path.push({ row, col });

    // Base case 4 (success): we've reached the end.
    if (row === end.row && col === end.col) {
        return true;
    }

    // Recursive case: try each direction from here.
    for (const { dr, dc } of DIRECTIONS) {
        const next = { row: row + dr, col: col + dc };

        if (solve(grid, visited, next, end, path)) {
            return true;
        }
    }
//backtracking
    visited[row][col] = false;
    path.pop();

    return false;
}

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
