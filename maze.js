const fs = require("fs");

// loadMaze reads and validates a maze file, returning
// { grid, start, end } where grid is an array of arrays of
// single characters, and start/end are { row, col } objects.
// Throws an Error with a clear message for any invalid maze.
function loadMaze(path) {
    let contents;
//It tells the main thread: stop everything and wait right here until this file is fully read.
//sync in scripts/CLI tools, async in servers.
    try {
        contents = fs.readFileSync(path, "utf8");
    } catch (err) {
        throw new Error(`Could not read file "${path}": ${err.message}`);
    }

    if (contents.trim() === "") {
        throw new Error("Maze file is empty.");
    }

    // Strip every trailing newline/blank line the editor added AFTER the
    // last row. Blank lines INSIDE the maze survive — the ragged check
    // catches them, because a "" row has length 0.
    const lines = contents.trimEnd().split("\n");

    let start = null;
    let end = null;
    const grid = [];
    const expectedWidth = lines[0].trimEnd().length;

    for (let row = 0; row < lines.length; row++) {
        const chars = lines[row].trimEnd().split("");

        if (chars.length !== expectedWidth) {
            throw new Error(
                `Ragged maze: row ${row + 1} has length ${chars.length}, but row 1 has length ${expectedWidth} — all rows must be the same length.`
            );
        }

        for (let col = 0; col < chars.length; col++) {
            const ch = chars[col];

            if (ch === "S") {
                if (start !== null) {
                    throw new Error(
                         `Multiple start positions found (at row ${start.row + 1},col ${start.col + 1} and row ${row + 1},col ${col + 1}).`
                    );
                }
                start = { row, col };
            } else if (ch === "E") {
                if (end !== null) {
                    throw new Error(
                        `Multiple end positions found (at row ${end.row +1},col ${end.col +1} and row ${row +1},col ${col +1}).`
                    );
                }
                end = { row, col };
            } else if (ch !== "#" && ch !== ".") {
                throw new Error(
                    `Invalid character "${ch}" at row ${row +1}, col ${col +1}.`
                );
            }
        }

        grid.push(chars);
    }

    if (start === null) {
        throw new Error("Maze has no start position (S).");
    }
    if (end === null) {
        throw new Error("Maze has no end position (E).");
    }

    return { grid, start, end };
}

module.exports = { loadMaze };