// Each match has a centre (x, y) and an angle in degrees.
function lineToMatch(line) {
    // JSON stores shape lines as [x1, y1, x2, y2].
    const [x1, y1, x2, y2] = line;
    return {
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2,
        angle: Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI
    };
}

// Copy matches so dragging leaves the original task unchanged.
function copyMatches(matches) {
    return matches.map(match => ({ ...match }));
}

// A 180-degree turn counts as the same position.
function angleDifference(first, second) {
    const difference = Math.abs(first - second) % 180;
    return Math.min(difference, 180 - difference);
}

// Allow small errors in position and angle.
function samePlace(first, second, distance = 8, angle = 7) {
    return Math.hypot(first.x - second.x, first.y - second.y) <= distance
        && angleDifference(first.angle, second.angle) <= angle;
}

// Each target position can match only one player match.
function countMatching(matches, target) {
    const used = new Set();
    let count = 0;
    for (const match of matches) {
        const index = target.findIndex((place, i) => !used.has(i) && samePlace(match, place));
        if (index !== -1) {
            used.add(index);
            count++;
        }
    }
    return count;
}

// Digit segments: a=top, b/c=right, d=bottom, e/f=left, g=middle.
function numberMatches(number, x) {
    const segments = {
        "0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg",
        "5": "acdfg", "6": "acdefg", "7": "abc", "8": "abcdefg", "9": "abcdfg"
    };
    const places = {
        a: { x: x + 60, y: 90, angle: 0 },
        b: { x: x + 120, y: 150, angle: 90 },
        c: { x: x + 120, y: 270, angle: 90 },
        d: { x: x + 60, y: 330, angle: 0 },
        e: { x, y: 270, angle: 90 },
        f: { x, y: 150, angle: 90 },
        g: { x: x + 60, y: 210, angle: 0 }
    };
    return [...segments[number]].map(segment => ({ ...places[segment] }));
}

function romanMatches(number, x, length = 180) {
    const matches = [];
    let core = "";
    if (number.includes("X")) core = "X";
    else if (number.includes("V")) core = "V";
    if (!core) {
        for (let i = 0; i < number.length; i++) matches.push({ x: x + i * 30, y: 210, angle: 90 });
        return matches;
    }
    // Keep X or V fixed when I moves to the other side.
    if (core === "X") {
        matches.push({ x, y: 210, angle: 60 }, { x, y: 210, angle: 120 });
    } else {
        matches.push({ x: x - length / 4, y: 210, angle: 60 }, { x: x + length / 4, y: 210, angle: 120 });
    }
    const [before, after] = number.split(core);
    const spacing = length / 2 + 8;
    for (let i = 0; i < before.length; i++) matches.push({ x: x - spacing - i * 30, y: 210, angle: 90 });
    for (let i = 0; i < after.length; i++) matches.push({ x: x + spacing + i * 30, y: 210, angle: 90 });
    return matches;
}

// Drawing sizes and positions; romanLegacy supports older saves.
const equationLayouts = {
    numbers: { width: 940, height: 420, length: 120, columns: [60, 390, 720], operatorX: 300, equalsX: 620 },
    numbersCompact: { width: 740, height: 420, length: 120, columns: [30, 310, 590], operatorX: 230, equalsX: 510 },
    roman: { width: 1080, height: 420, length: 180, columns: [110, 490, 900], operatorX: 340, equalsX: 690 },
    romanLegacy: { width: 940, height: 420, length: 120, columns: [120, 430, 740], operatorX: 300, equalsX: 620 }
};

// Build movable matches from an expression such as "6 - 1 = 3".
function equationMatches(expression, type, legacy = false, compact = false) {
    const [left, operator, right, , result] = expression.split(" ");
    const layout = equationLayouts[type === "roman" && legacy ? "romanLegacy"
        : type === "numbers" && compact ? "numbersCompact" : type];
    const makeNumber = type === "numbers" ? numberMatches : romanMatches;
    const matches = [
        ...makeNumber(left, layout.columns[0], layout.length),
        { x: layout.operatorX, y: 210, angle: 0 },
        ...makeNumber(right, layout.columns[1], layout.length),
        ...makeNumber(result, layout.columns[2], layout.length)
    ];
    if (operator === "+") matches.push({ x: layout.operatorX, y: 210, angle: 90 });
    return matches;
}

// Convert each task type to the same board format.
function preparePuzzle(task, compact = false, legacyNumbers = false) {
    if (task.type === "shape") {
        // Trim empty side margins on phones.
        const place = line => {
            const match = lineToMatch(line);
            if (compact) match.x -= task.width / 10;
            return match;
        };
        return {
            compact, width: compact ? task.width * 0.8 : task.width, height: task.height, length: task.length,
            start: task.start.map(place),
            solutions: task.solutions.map(solution => solution.map(place)),
            fixed: []
        };
    }
    const layout = equationLayouts[task.type === "numbers" && compact ? "numbersCompact" : task.type];
    const puzzle = {
        compact,
        width: layout.width, height: layout.height, length: layout.length,
        start: equationMatches(task.start, task.type, false, compact),
        solutions: task.solutions.map(solution => equationMatches(solution, task.type, false, compact)),
        fixed: [{ x: layout.equalsX, y: 194, angle: 0 }, { x: layout.equalsX, y: 226, angle: 0 }]
    };
    if (task.type === "numbers" && compact && !legacyNumbers) {
        // Keep full-size digits on two rows on phones.
        const wrap = match => match.x >= 590
            ? { ...match, x: match.x - 330, y: match.y + 255 }
            : { ...match, y: match.y - 45 };
        puzzle.width = 480;
        puzzle.height = 630;
        puzzle.start = puzzle.start.map(wrap);
        puzzle.solutions = puzzle.solutions.map(solution => solution.map(wrap));
        puzzle.fixed = [{ x: 150, y: 449, angle: 0 }, { x: 150, y: 481, angle: 0 }];
    }
    if (task.type === "roman" && compact) {
        // Place the result on a second row on phones.
        const wrap = match => match.x >= 790
            ? { ...match, x: match.x - 530, y: match.y + 180 }
            : { ...match, y: match.y - 80 };
        puzzle.width = 640;
        puzzle.height = 520;
        puzzle.start = puzzle.start.map(wrap);
        puzzle.solutions = puzzle.solutions.map(solution => solution.map(wrap));
        puzzle.fixed = [{ x: 150, y: 374, angle: 0 }, { x: 150, y: 406, angle: 0 }];
    }
    return puzzle;
}

// Keep both ends of the match inside the board.
function keepMatchInside(match, puzzle, top = 0, bottom = puzzle.height) {
    const angle = match.angle * Math.PI / 180;
    const marginX = Math.abs(Math.cos(angle)) * puzzle.length / 2 + 9;
    const marginY = Math.abs(Math.sin(angle)) * puzzle.length / 2 + 9;
    match.x = Math.max(marginX, Math.min(puzzle.width - marginX, match.x));
    match.y = Math.max(top + marginY, Math.min(bottom - marginY, match.y));
}

// Map known positions exactly; scale other positions to fit.
function moveMatchesToLayout(matches, previous, next) {
    const oldPlaces = [previous.start, ...previous.solutions].flat();
    const newPlaces = [next.start, ...next.solutions].flat();
    return matches.map(match => {
        const index = oldPlaces.findIndex(place => samePlace(match, place));
        if (index !== -1) return { ...newPlaces[index], angle: match.angle };
        const moved = { ...match,
            x: match.x * next.width / previous.width,
            y: match.y * next.height / previous.height };
        keepMatchInside(moved, next);
        return moved;
    });
}

// Keep saved progress when enlarging Roman matches.
function enlargeSavedRoman(matches, task) {
    const previous = {
        width: 940, height: 420,
        start: equationMatches(task.start, "roman", true),
        solutions: task.solutions.map(solution => equationMatches(solution, "roman", true))
    };
    return moveMatchesToLayout(matches, previous, preparePuzzle(task));
}

// Check changed positions and stored solutions, not drag count.
function isSolved(matches, puzzle, moves) {
    if (matches.length !== puzzle.start.length) return false;
    const changed = matches.length - countMatching(matches, puzzle.start);
    return changed === moves && puzzle.solutions.some(solution => countMatching(matches, solution) === matches.length);
}
