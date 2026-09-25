const { DIRECTIONS } = require("./solver");

function bfsSolve(grid, start, end) {
    const numRows = grid.length;

    const visited = grid.map(row => row.map(() => false));
    const cameFrom = grid.map(row => row.map(() => null));

    
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

function bfsSolveMaze(maze) {
    return bfsSolve(maze.grid, maze.start, maze.end);
}

module.exports = { bfsSolveMaze, bfsSolve };
