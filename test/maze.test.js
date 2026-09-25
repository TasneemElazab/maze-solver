"use strict";

// Tests for the maze solver. They use only Node's built-in test runner and
// assert module, so `npm test` works with no install step.
//
// The fixtures that the error-handling and CLI tests need are written to a
// scratch directory when the run starts and deleted when it finishes, so the
// suite never leaves files behind and never touches the project.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const { loadMaze } = require("../maze");
const { solveMaze, solve } = require("../solver");
const { bfsSolveMaze } = require("../bfs-solver");

const LF = "\n";
const ROOT = path.join(__dirname, "..");
const INDEX = path.join(ROOT, "index.js");
const PROJECT_MAZE = path.join(ROOT, "maze.txt");

let tmpDir;

before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "maze-solver-tests-"));
});

after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Write a throwaway fixture file and return its path. */
function fixture(name, contents) {
    const file = path.join(tmpDir, name);
    fs.writeFileSync(file, contents, "utf8");
    return file;
}

/** Join rows into the body of a maze file. */
function mazeText(rows, lineEnding = LF) {
    return rows.join(lineEnding) + lineEnding;
}

/** Run the CLI, returning its exit status and streams instead of throwing. */
function runCli(args) {
    try {
        const stdout = execFileSync(process.execPath, [INDEX, ...args], {
            cwd: ROOT,
            encoding: "utf8",
        });
        return { status: 0, stdout, stderr: "" };
    } catch (err) {
        return { status: err.status, stdout: err.stdout || "", stderr: err.stderr || "" };
    }
}

/**
 * Assert that `found` is a legal walk: it starts at S, ends at E, every step is
 * a single orthogonal move, no cell repeats, and it never steps onto a wall.
 * This is what proves the solver returned a path rather than a plausible-looking
 * list of cells.
 */
function assertLegalPath(grid, start, end, found) {
    assert.ok(Array.isArray(found), "expected an array of cells");
    assert.ok(found.length > 0, "expected a non-empty path");
    assert.deepEqual(found[0], { row: start.row, col: start.col }, "path must start at S");
    assert.deepEqual(found[found.length - 1], { row: end.row, col: end.col }, "path must end at E");

    const seen = new Set();

    for (let i = 0; i < found.length; i += 1) {
        const { row, col } = found[i];

        assert.notEqual(grid[row][col], "#", `cell (${row},${col}) is a wall`);

        const key = `${row},${col}`;
        assert.equal(seen.has(key), false, `cell (${row},${col}) repeats`);
        seen.add(key);

        if (i > 0) {
            const previous = found[i - 1];
            const step = Math.abs(row - previous.row) + Math.abs(col - previous.col);
            assert.equal(step, 1, `step ${i - 1} -> ${i} is not one orthogonal move`);
        }
    }
}

/**
 * An independent shortest-path search, written straight from the definition,
 * used to cross-check bfsSolveMaze. Returns the number of cells on a shortest
 * path including both ends, or null when E is unreachable.
 */
function referenceShortestLength(grid, start, end) {
    const distances = grid.map(row => row.map(() => -1));
    distances[start.row][start.col] = 0;

    const queue = [start];
    let head = 0;

    while (head < queue.length) {
        const current = queue[head++];
        const next = distances[current.row][current.col] + 1;

        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const row = current.row + dr;
            const col = current.col + dc;

            if (row < 0 || row >= grid.length) continue;
            if (col < 0 || col >= grid[row].length) continue;
            if (grid[row][col] === "#") continue;
            if (distances[row][col] !== -1) continue;

            distances[row][col] = next;
            queue.push({ row, col });
        }
    }

    return distances[end.row][end.col] === -1 ? null : distances[end.row][end.col] + 1;
}

// ---------------------------------------------------------------------------
// maze.js — reading and validating the file format
// ---------------------------------------------------------------------------

describe("loadMaze", () => {
    it("parses the project maze into a grid plus a start and an end", () => {
        const maze = loadMaze(PROJECT_MAZE);

        assert.equal(maze.grid.length, 5);
        assert.equal(maze.grid[0].length, 8);
        assert.deepEqual(maze.start, { row: 1, col: 1 });
        assert.deepEqual(maze.end, { row: 1, col: 6 });
    });

    it("tolerates trailing whitespace and trailing blank lines", () => {
        const body = "#####  " + LF + "#S.E#\t" + LF + "#####  " + LF + LF + LF;
        const maze = loadMaze(fixture("trailing.txt", body));

        assert.deepEqual(maze.grid, [
            ["#", "#", "#", "#", "#"],
            ["#", "S", ".", "E", "#"],
            ["#", "#", "#", "#", "#"],
        ]);
    });

    it("tolerates CRLF line endings", () => {
        const file = fixture("crlf.txt", mazeText(["####", "#SE#", "####"], "\r\n"));
        const maze = loadMaze(file);

        assert.equal(maze.grid.length, 3);
        assert.deepEqual(maze.grid[1], ["#", "S", "E", "#"]);
    });

    it("reports an unreadable file", () => {
        assert.throws(() => loadMaze(path.join(tmpDir, "missing.txt")), /Could not read file/);
    });

    it("reports an empty file", () => {
        assert.throws(() => loadMaze(fixture("empty.txt", "")), /empty/i);
    });

    it("reports a whitespace-only file as empty", () => {
        assert.throws(() => loadMaze(fixture("blank.txt", LF + "   " + LF)), /empty/i);
    });

    it("reports a maze with no start", () => {
        const rows = ["###", "#.E", "###"];
        assert.throws(() => loadMaze(fixture("no-start.txt", mazeText(rows))), /no start position/);
    });

    it("reports a maze with no end", () => {
        const rows = ["###", "#S.", "###"];
        assert.throws(() => loadMaze(fixture("no-end.txt", mazeText(rows))), /no end position/);
    });

    it("reports a maze with more than one start", () => {
        const rows = ["#####", "#S..#", "#S.E#", "#####"];
        assert.throws(() => loadMaze(fixture("two-starts.txt", mazeText(rows))), /Multiple start/);
    });

    it("reports a maze with more than one end", () => {
        const rows = ["#####", "#S.E#", "#..E#", "#####"];
        assert.throws(() => loadMaze(fixture("two-ends.txt", mazeText(rows))), /Multiple end/);
    });

    it("reports a ragged, non-rectangular maze", () => {
        const rows = ["#####", "#S..#", "#.E#", "#####"];
        assert.throws(() => loadMaze(fixture("ragged.txt", mazeText(rows))), /Ragged/);
    });

    it("reports a blank line in the middle of the maze", () => {
        const rows = ["#####", "#S.E#", "", "#####"];
        assert.throws(() => loadMaze(fixture("mid-blank.txt", mazeText(rows))), /Ragged/);
    });

    it("reports an unrecognised character", () => {
        const rows = ["#####", "#S.X#", "#..E#", "#####"];
        assert.throws(() => loadMaze(fixture("bad-char.txt", mazeText(rows))), /Invalid character/);
    });

    it("reports a space in the middle of a row", () => {
        const rows = ["#####", "#S .#", "#..E#", "#####"];
        assert.throws(() => loadMaze(fixture("inner-space.txt", mazeText(rows))), /Invalid character/);
    });
});

// ---------------------------------------------------------------------------
// solver.js — the recursive backtracking search
// ---------------------------------------------------------------------------

describe("solveMaze", () => {
    it("finds a legal path through the project maze", () => {
        const maze = loadMaze(PROJECT_MAZE);
        const found = solveMaze(maze);

        assertLegalPath(maze.grid, maze.start, maze.end, found);
        assert.equal(found.length, 10);
    });

    it("returns null when no path exists", () => {
        const file = fixture("walled.txt", mazeText(["#####", "#S#E#", "#####"]));

        assert.equal(solveMaze(loadMaze(file)), null);
    });

    it("terminates on a maze containing a cycle", () => {
        const rows = ["#####", "#S..#", "#.#.#", "#.#.#", "#..E#", "#####"];
        const maze = loadMaze(fixture("cycle.txt", mazeText(rows)));
        const found = solveMaze(maze);

        assertLegalPath(maze.grid, maze.start, maze.end, found);
    });

    it("handles a start adjacent to the end", () => {
        const file = fixture("adjacent.txt", mazeText(["####", "#SE#", "####"]));
        const maze = loadMaze(file);
        const found = solveMaze(maze);

        assertLegalPath(maze.grid, maze.start, maze.end, found);
        assert.equal(found.length, 2);
    });

    it("handles a single-row maze", () => {
        const maze = loadMaze(fixture("one-row.txt", "S.E" + LF));
        const found = solveMaze(maze);

        assertLegalPath(maze.grid, maze.start, maze.end, found);
        assert.deepEqual(found, [
            { row: 0, col: 0 },
            { row: 0, col: 1 },
            { row: 0, col: 2 },
        ]);
    });

    it("returns the same path when the same maze is solved twice", () => {
        // Regression test for the stateful-visited trap. A successful search
        // deliberately leaves `visited` fully marked. solveMaze() owns that
        // array, so a second call starts clean instead of seeing every cell as
        // already visited and wrongly reporting "no path".
        const maze = loadMaze(PROJECT_MAZE);

        assert.deepEqual(solveMaze(maze), solveMaze(maze));
    });

    it("leaves the low-level search's scratch arrays untouched when it fails", () => {
        const file = fixture("walled-again.txt", mazeText(["#####", "#S#E#", "#####"]));
        const maze = loadMaze(file);
        const visited = maze.grid.map(row => row.map(() => false));
        const path = [];

        const found = solve(maze.grid, visited, maze.start, maze.end, path);

        assert.equal(found, false);
        assert.equal(visited.flat().filter(Boolean).length, 0, "a failed search must leave no trace");
        assert.deepEqual(path, [], "a failed search must not leave cells on the path");
    });

    it("builds a long path in linear time rather than quadratic", () => {
        // The path used to be rebuilt with a spread on every frame unwind,
        // which is O(length squared). The bound here is deliberately loose so
        // the test does not turn flaky on a slow machine.
        const length = 4000;
        const maze = loadMaze(fixture("corridor.txt", "S" + ".".repeat(length - 2) + "E" + LF));

        const started = process.hrtime.bigint();
        const found = solveMaze(maze);
        const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

        assert.equal(found.length, length);
        assert.ok(elapsedMs < 150, `expected under 150ms for ${length} cells, took ${elapsedMs.toFixed(1)}ms`);
    });
});

// ---------------------------------------------------------------------------
// bfs-solver.js — the iterative shortest-path search
// ---------------------------------------------------------------------------

describe("bfsSolveMaze", () => {
    it("finds a legal path through the project maze", () => {
        const maze = loadMaze(PROJECT_MAZE);
        const found = bfsSolveMaze(maze);

        assertLegalPath(maze.grid, maze.start, maze.end, found);
        assert.equal(found.length, 6);
    });

    it("finds the shortest path, matching an independent reference search", () => {
        const maze = loadMaze(PROJECT_MAZE);
        const found = bfsSolveMaze(maze);

        assert.equal(found.length, referenceShortestLength(maze.grid, maze.start, maze.end));
    });

    it("is never longer than the recursive solver's path", () => {
        const maze = loadMaze(PROJECT_MAZE);

        assert.ok(bfsSolveMaze(maze).length <= solveMaze(maze).length);
    });

    it("agrees with the recursive solver when the route is unique", () => {
        const rows = [
            "#######",
            "#S....#",
            "#####.#",
            "#.....#",
            "#.#####",
            "#....E#",
            "#######",
        ];
        const maze = loadMaze(fixture("unique-route.txt", mazeText(rows)));
        const found = bfsSolveMaze(maze);

        assertLegalPath(maze.grid, maze.start, maze.end, found);
        assert.equal(found.length, solveMaze(maze).length);
    });

    it("returns null when no path exists", () => {
        const file = fixture("walled-bfs.txt", mazeText(["#####", "#S#E#", "#####"]));

        assert.equal(bfsSolveMaze(loadMaze(file)), null);
    });

    it("terminates on a maze containing a cycle", () => {
        const rows = ["#####", "#S..#", "#.#.#", "#.#.#", "#..E#", "#####"];
        const maze = loadMaze(fixture("cycle-bfs.txt", mazeText(rows)));

        assertLegalPath(maze.grid, maze.start, maze.end, bfsSolveMaze(maze));
    });

    it("matches the reference search across several maze shapes", () => {
        const shapes = [
            ["#####", "#S..#", "#.#.#", "#.#.#", "#..E#", "#####"],
            ["########", "#S....E#", "#.####.#", "#......#", "########"],
            ["S.E"],
            ["#######", "#S....#", "#####.#", "#.....#", "#.#####", "#....E#", "#######"],
        ];

        for (const rows of shapes) {
            const label = `${rows.length}x${rows[0].length}`;
            const maze = loadMaze(fixture(`shape-${label}.txt`, mazeText(rows)));
            const expected = referenceShortestLength(maze.grid, maze.start, maze.end);
            const found = bfsSolveMaze(maze);

            if (expected === null) {
                assert.equal(found, null, `shape ${label} should be unsolvable`);
            } else {
                assert.equal(found.length, expected, `shape ${label} should be shortest`);
                assertLegalPath(maze.grid, maze.start, maze.end, found);
            }
        }
    });

    it("solves a maze whose forced route is far longer than the recursive solver can handle", () => {
        // The recursion depth cap is only a few thousand frames, so a route
        // this long blows the recursive solver's stack. The iterative solver
        // has no such limit.
        const length = 20000;
        const maze = loadMaze(fixture("long-corridor.txt", "S" + ".".repeat(length - 2) + "E" + LF));
        const found = bfsSolveMaze(maze);

        assert.equal(found.length, length);
        assertLegalPath(maze.grid, maze.start, maze.end, found);
    });
});

// ---------------------------------------------------------------------------
// index.js — argument handling, rendering and the recursion-depth guard
// ---------------------------------------------------------------------------

describe("command line", () => {
    it("prints the maze back with the recursive solver's path marked", () => {
        const result = runCli([PROJECT_MAZE]);

        assert.equal(result.status, 0);
        assert.equal(
            result.stdout,
            ["########", "#S....E#", "#*####*#", "#******#", "########", ""].join(LF)
        );
    });

    it("prints the shortest path with --bfs", () => {
        const result = runCli([PROJECT_MAZE, "--bfs"]);

        assert.equal(result.status, 0);
        assert.equal(
            result.stdout,
            ["########", "#S****E#", "#.####.#", "#......#", "########", ""].join(LF)
        );
    });

    it("leaves S and E in place instead of overwriting them with stars", () => {
        const lines = runCli([PROJECT_MAZE]).stdout.split(LF);

        assert.equal(lines[1][1], "S");
        assert.equal(lines[1][6], "E");
    });

    it("prints only the no-path message when the maze is sealed", () => {
        const file = fixture("sealed.txt", mazeText(["#####", "#S#E#", "#####"]));
        const result = runCli([file]);

        assert.equal(result.status, 0);
        assert.equal(result.stdout, "No path exists." + LF);
    });

    it("prints the same no-path message for --bfs", () => {
        const file = fixture("sealed-bfs.txt", mazeText(["#####", "#S#E#", "#####"]));

        assert.equal(runCli([file, "--bfs"]).stdout, "No path exists." + LF);
    });

    it("prints usage and exits non-zero when no file is given", () => {
        const result = runCli([]);

        assert.equal(result.status, 1);
        assert.match(result.stderr, /Usage/);
    });

    it("reports an unreadable file on stderr and exits non-zero", () => {
        const result = runCli([path.join(tmpDir, "does-not-exist.txt")]);

        assert.equal(result.status, 1);
        assert.equal(result.stdout, "");
        assert.match(result.stderr, /Could not read file/);
    });

    it("reports an invalid maze on stderr and exits non-zero", () => {
        const file = fixture("ragged-cli.txt", mazeText(["#####", "#S..#", "#.E#", "#####"]));
        const result = runCli([file]);

        assert.equal(result.status, 1);
        assert.match(result.stderr, /Ragged/);
    });

    it("catches the recursive solver's stack overflow and suggests --bfs", () => {
        // A single long corridor forces a recursion depth far past what Node's
        // default stack allows. Before the guard this dumped a raw RangeError
        // trace on the user; now it has to be a clear message that names the
        // way out, and the way out has to actually work.
        const file = fixture("too-long.txt", "S" + ".".repeat(20000 - 2) + "E" + LF);

        const recursive = runCli([file]);
        assert.equal(recursive.status, 1);
        assert.equal(recursive.stdout, "");
        assert.match(recursive.stderr, /too large for the recursive solver/);
        assert.match(recursive.stderr, /--bfs/);
        assert.doesNotMatch(recursive.stderr, /RangeError/);

        const iterative = runCli([file, "--bfs"]);
        assert.equal(iterative.status, 0);
        assert.equal(iterative.stdout.split(LF)[0].length, 20000);
    });
});




