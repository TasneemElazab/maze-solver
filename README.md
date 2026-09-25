# Maze Solver

A command-line tool that reads a maze from a text file, finds a path from `S`
to `E`, and prints the maze back with the route marked.

Two solvers ship side by side:

- **`solver.js` — recursive backtracking (depth-first search).** This is the
  point of the project: a single cell answers "can I reach the end from here?"
  by asking the exact same question of each of its neighbours, so the answer to
  the whole problem is built out of answers to smaller versions of the same
  problem.
- **`bfs-solver.js` — breadth-first search with an explicit queue.** Same output
  format, but guaranteed to find the *shortest* path, and it cannot run out of
  stack.

## Requirements

Node.js 20 or newer. No dependencies, no install step.

## Usage

```
node index.js maze.txt          # recursive solver
node index.js maze.txt --bfs    # shortest-path solver
```

or, using the scripts in `package.json`:

```
npm start                       # solves the bundled maze.txt recursively
```

## Maze file format

Plain text, one row per line:

| Character | Meaning |
| --- | --- |
| `#` | wall — cannot be entered |
| `.` | open floor |
| `S` | start (counts as open floor) — exactly one |
| `E` | end (counts as open floor) — exactly one |

The bundled `maze.txt`:

```
########
#S....E#
#.####.#
#......#
########
```

Trailing whitespace on a line and trailing blank lines at the end of the file
are ignored, and CRLF line endings are fine.

## Movement rules

- Four directions only: up, down, left, right. No diagonals.
- A move is legal only onto an in-bounds cell that is not a wall.
- A cell may not be revisited within the same attempt, which is what stops the
  search looping forever on mazes containing cycles.

## Output

Every cell on the found path (excluding `S` and `E`, which keep their own
characters) is printed as `*`:

```
$ node index.js maze.txt
########
#S....E#
#*####*#
#******#
########
```

If no path exists, the program prints exactly this and nothing else:

```
No path exists.
```

## Errors

The program exits with status 1 and a clear message on stderr for: an
unreadable file, an empty file, no `S` or more than one `S`, no `E` or more than
one `E`, rows of different lengths, and any character that is not `#`, `.`, `S`
or `E`.

## Which solver should I use?

The bundled `maze.txt` has more than one valid route, so it shows the difference
plainly:

| Solver | Path length | Notes |
| --- | --- | --- |
| recursive (`solver.js`) | 10 cells | valid, but not the shortest |
| `--bfs` (`bfs-solver.js`) | 6 cells | shortest |

DFS does not guarantee a shortest path because it commits to the first direction
that leads anywhere and only backs out once it hits a dead end. BFS does
guarantee it, because it explores in rings of increasing distance from the start,
so the first time it reaches `E` it has arrived by a shortest route.

### Known limitation: recursion depth

The recursive solver's stack depth grows with the length of the walk it is
exploring — and because it dives into dead-end branches before backing out, that
depth can be much longer than the final path. Node's default stack tops out after
roughly 3,000–6,500 frames of this function, depending on the maze's shape, so a
large maze can exhaust it.

When that happens the program says so instead of crashing with a raw stack
trace:

```
$ node index.js huge-maze.txt
Error: Maze is too large for the recursive solver - re-run with --bfs.
```

`--bfs` never recurses, so it solves those mazes fine. Measured: a 201×201
carved maze with a 5,751-cell route fails the recursive solver roughly half the
time, while `--bfs` solves it in about 90 ms.

## Project layout

| File | Purpose |
| --- | --- |
| `index.js` | CLI: reads arguments, calls a solver, renders the result |
| `maze.js` | reads and validates the maze file |
| `solver.js` | recursive DFS, public entry point `solveMaze(maze)` |
| `bfs-solver.js` | iterative BFS, public entry point `bfsSolveMaze(maze)` |
| `maze.txt` | the sample maze |
| `test/maze.test.js` | test suite |

## Tests

```
npm test
```

Uses Node's built-in test runner, so there is nothing to install. The suite
covers the parser's error cases, path legality (the path really starts at `S`,
ends at `E`, moves one cell at a time, never repeats a cell and never crosses a
wall), the shortest-path guarantee checked against an independent reference
search, the `visited` cleanup invariant, and the CLI's output, exit codes and
recursion-depth guard. Fixtures are written to a scratch directory outside the
project and deleted when the run finishes.

## Design notes

- `solveMaze(maze)` and `bfsSolveMaze(maze)` take the same argument and own their
  own scratch arrays, so `index.js` can swap between them without knowing either
  solver's internals — and a `visited` grid left dirty by a previous successful
  search can never be handed in by mistake.
- The recursive solver builds its route in one array that it pushes onto while
  descending and pops from while backtracking, which keeps the work linear in the
  length of the path rather than quadratic.
- A successful recursive search deliberately leaves `visited` fully marked, since
  the path itself is the answer at that point. That array is owned by
  `solveMaze` and never reused, so the shortcut is safe. A *failed* search always
  cleans up after itself, leaving both `visited` and the path exactly as they
  were before the call.
