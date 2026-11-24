// Each category stores its task order, current index and match positions.
const storageKey = "iskra-progress-v1";
let progress = { category: "numbers", categories: {} };

// Shuffle a copy and save the order to avoid repeats.
function shuffled(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function currentProgress() {
    return progress.categories[progress.category];
}

function loadProgress() {
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        if (saved && saved.categories && typeof saved.categories === "object") progress = saved;
    } catch {
        showStorageNotice();
    }
    if (!catalogue.categories.some(category => category.id === progress.category)) {
        progress.category = catalogue.categories[0].id;
    }
    for (const category of catalogue.categories) {
        const ids = catalogue.tasks.filter(task => task.category === category.id).map(task => task.id);
        const saved = progress.categories[category.id];
        // Check that saved task IDs still exist.
        const valid = saved && Array.isArray(saved.order) && new Set(saved.order).size === saved.order.length
            && saved.order.every(id => ids.includes(id)) && Number.isInteger(saved.index)
            && saved.index >= 0 && saved.index <= saved.order.length;
        if (!valid) {
            progress.categories[category.id] = { order: shuffled(ids), index: 0, taskId: null, matches: [], solved: false };
        } else {
            // Append new tasks without repeating completed ones.
            saved.order.push(...shuffled(ids.filter(id => !saved.order.includes(id))));
        }
    }
}

function showStorageNotice() {
    const notice = document.querySelector("#storage-notice");
    notice.hidden = false;
    notice.textContent = "Uložený postup sa nepodarilo načítať alebo zapísať. Ak máš ukladanie zablokované, postup sa po zatvorení stránky nezachová.";
}

function saveProgress() {
    if (!currentTask) return;
    cancelDrag();
    const saved = currentProgress();
    saved.taskId = currentTask.id;
    saved.matches = copyMatches(currentMatches);
    // Remember which layout these coordinates belong to.
    saved.compact = currentPuzzle.compact;
    saved.layoutVersion = 2;
    try {
        // localStorage stores the progress object as a JSON string.
        localStorage.setItem(storageKey, JSON.stringify(progress));
    } catch {
        showStorageNotice();
    }
}

// Check saved coordinates before drawing.
function validSavedMatches(matches, puzzle) {
    return Array.isArray(matches) && matches.length === puzzle.start.length
        && matches.every(match => match && Number.isFinite(match.x) && Number.isFinite(match.y)
            && Number.isFinite(match.angle) && match.x >= 0 && match.x <= puzzle.width
            && match.y >= 0 && match.y <= puzzle.height);
}

function restoreTaskProgress(saved) {
    let matches;
    const legacyNumbers = currentTask.type === "numbers" && saved.compact && saved.layoutVersion !== 2;
    const savedPuzzle = preparePuzzle(currentTask, Boolean(saved.compact), legacyNumbers);
    if (saved.taskId === currentTask.id && validSavedMatches(saved.matches, savedPuzzle)) {
        // Convert saves from the older Roman layout.
        matches = currentTask.type === "roman" && saved.layoutVersion !== 2
            ? enlargeSavedRoman(saved.matches, currentTask) : copyMatches(saved.matches);
        if (legacyNumbers || savedPuzzle.compact !== currentPuzzle.compact) {
            matches = moveMatchesToLayout(matches, savedPuzzle, currentPuzzle);
        }
        // Check the answer again before accepting saved success.
        saved.solved = Boolean(saved.solved) && isSolved(matches, currentPuzzle, currentTask.moves);
    } else {
        matches = copyMatches(currentPuzzle.start);
        saved.solved = false;
    }
    return matches;
}

function updateProgressBars() {
    // Current category
    const saved = currentProgress();
    const completed = saved.index;
    const total = saved.order.length;

    const percentage = total ? completed / total * 100 : 0;

    document.querySelector("#category-progress").style.width = `${percentage}%`;
    document.querySelector("#category-progress-text").textContent = `${completed} / ${total}`;

    // All categories
    let allCompleted = 0;
    let allTasks = 0;

    const container = document.querySelector("#category-progress-list");
    container.replaceChildren();

    for (const category of catalogue.categories) {
        const categoryProgress = progress.categories[category.id];
        const done = categoryProgress.index;
        const count = categoryProgress.order.length;

        allCompleted += done;
        allTasks += count;

        const item = document.createElement("div");
        item.className = "category-progress-item";

        const info = document.createElement("div");
        info.className = "progress-info";

        const name = document.createElement("span");
        name.textContent = category.name;

        const countText = document.createElement("span");
        countText.textContent = `${done} / ${count}`;

        info.append(name, countText);

        const track = document.createElement("div");
        track.className = "progress-track";

        const fill = document.createElement("div");
        fill.className = "progress-fill";
        fill.style.width = `${count ? done / count * 100 : 0}%`;

        track.append(fill);
        item.append(info, track);
        container.append(item);
    }

    document.querySelector("#overall-progress").style.width = `${allTasks ? allCompleted / allTasks * 100 : 0}%`;
    document.querySelector("#overall-progress-text").textContent = `${allCompleted} / ${allTasks}`;
}