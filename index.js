const { loadMaze } = require("./maze");
const { solveMaze } = require("./solver");
const { bfsSolveMaze } = require("./bfs-solver");

const args = process.argv.slice(2);
const useBfs = args.includes("--bfs");
const path = args.find(arg => arg !== "--bfs");

if (!path) {
    console.error("Usage: node index.js maze.txt [--bfs]");
    process.exit(1);
}

let maze;
try {
    maze = loadMaze(path);
} catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
}

// Both solvers take the same { grid, start, end } object and own their
// own scratch arrays, so choosing between them is a one-line change and
// this file never has to allocate a `visited` grid itself.
let foundPath;
if (useBfs) {
    foundPath = bfsSolveMaze(maze);
} else {
    // The recursive solver's stack depth grows with the length of the
    // walk it is exploring, not with the length of the final path: it
    // dives into dead-end branches before backing out, so the deepest
    // point of the recursion can be far longer than the answer. Node's
    // default stack runs out somewhere around a few thousand frames for
    // this function, so a perfectly valid large maze throws a RangeError
    // instead of solving. Catch that and point the user at the iterative
    // solver, because a raw stack trace is not an answer.
    try {
        foundPath = solveMaze(maze);
    } catch (err) {
        if (err instanceof RangeError && /call stack/i.test(err.message)) {
            console.error("Error: Maze is too large for the recursive solver - re-run with --bfs.");
            process.exit(1);
        }
        throw err;
    }
}

if (!foundPath) {
    console.log("No path exists.");
    process.exit(0);
}

const output = maze.grid.map(row => [...row]);
for (const { row, col } of foundPath) {
    if (output[row][col] === ".") {
        output[row][col] = "*";
    }
}
console.log(output.map(row => row.join("")).join("\n"));