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

let foundPath;
if (useBfs) {
    foundPath = bfsSolveMaze(maze);
} else {
    
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
