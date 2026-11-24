// Load tasks, restore progress, then handle player actions.
const mobileLayout = window.matchMedia("(max-width: 600px)");
const difficultyNames = { easy: "Ľahká", medium: "Stredná", hard: "Ťažká" };
const feedback = document.querySelector("#feedback");
const gameDialog = document.querySelector("#dialog");
const checkButton = document.querySelector("#check-button");
let catalogue = null;
// currentTask: JSON data; currentPuzzle: positions; currentMatches: player moves.
let currentTask = null;
let currentPuzzle = null;
let currentMatches = [];
let showingSolution = false;
let solutionSource = "button";

function renderCategories() {
    const container = document.querySelector("#categories");
    container.replaceChildren();
    for (const category of catalogue.categories) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = category.name;
        button.dataset.category = category.id;
        button.setAttribute("aria-pressed", String(category.id === progress.category));
        button.addEventListener("click", () => selectCategory(category.id));
        container.append(button);
    }
}

function selectCategory(id) {
    if (id !== progress.category) {
        stopRecording();
        saveProgress();
        progress.category = id;
    }
    document.querySelectorAll("#categories button").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.category === id));
    });
    loadCurrentTask();
}

function loadCurrentTask() {
    const saved = currentProgress();
    // Keep the last task visible after completing the category.
    const index = Math.min(saved.index, saved.order.length - 1);
    currentTask = catalogue.tasks.find(task => task.id === saved.order[index]);
    currentPuzzle = preparePuzzle(currentTask, mobileLayout.matches);
    currentMatches = restoreTaskProgress(saved);
    showingSolution = false;
    selectedMatch = -1;
    pointerAction = null;
    feedback.textContent = "";
    renderTask(index);
    saveProgress();
}

function renderTask(index) {
    const saved = currentProgress();
    document.querySelector("#task-counter").textContent = `Úloha ${index + 1} / ${saved.order.length}`;
    const difficulty = document.querySelector("#difficulty");
    difficulty.textContent = difficultyNames[currentTask.difficulty];
    difficulty.className = currentTask.difficulty;
    document.querySelector("#task-title").textContent = currentTask.title;
    document.querySelector("#task-description").textContent = currentTask.description;
    canvas.setAttribute("aria-label", `${currentTask.title}. ${currentTask.description} ${currentTask.type === "shape" ? "" : currentTask.start}`);
    updateGameButtons();
    resizeBoard();
}

// After a correct answer, this button opens the next task.
function updateGameButtons() {
    const saved = currentProgress();
    const complete = saved.index >= saved.order.length;
    if (complete) checkButton.textContent = "Kategória dokončená";
    else if (saved.solved) checkButton.textContent = "Ďalšia úloha";
    else checkButton.textContent = "Skontrolovať";
    checkButton.disabled = showingSolution;
    document.querySelector("#solution-notice").hidden = !showingSolution;
    document.querySelector("#board-help").style.visibility = showingSolution ? "hidden" : "visible";
    document.querySelector("#solution-button").setAttribute("aria-pressed", String(showingSolution));
    document.querySelector("#reset-button").disabled = saved.solved || complete;
    document.querySelector("#hint-button").disabled = saved.solved || complete;
    document.querySelector("#solution-button").disabled = saved.solved || complete;
}

// Show the solution without changing the player's matches.
function showSolution(source = "button") {
    if (!currentTask || currentProgress().solved || currentProgress().index >= currentProgress().order.length || gameDialog.open) return;
    cancelDrag();
    showingSolution = true;
    solutionSource = source;
    selectedMatch = -1;
    pointerAction = null;
    feedback.textContent = "";
    updateGameButtons();
    drawBoard();
}

function hideSolution() {
    showingSolution = false;
    updateGameButtons();
    drawBoard();
}

function resetTask() {
    if (!currentTask || currentProgress().solved || currentProgress().index >= currentProgress().order.length) return;
    showingSolution = false;
    currentMatches = copyMatches(currentPuzzle.start);
    selectedMatch = -1;
    pointerAction = null;
    feedback.textContent = "Úloha je obnovená.";
    updateGameButtons();
    saveProgress();
    drawBoard();
}

// Reuse one dialog with different text, icons and button actions.
function openDialog(title, text, icon, actions) {
    document.querySelector("#recording-preview").pause();
    document.querySelector("#recording-preview").hidden = true;
    document.querySelector("#dialog-title").textContent = title;
    document.querySelector("#dialog-text").textContent = text;
    document.querySelector("#dialog-symbol").setAttribute("href", `img/icons.svg#${icon}`);
    const container = document.querySelector("#dialog-actions");
    container.replaceChildren();
    actions.forEach((action, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = action.label;
        button.className = index === 0 ? "primary-button" : "outline-button";
        button.addEventListener("click", () => {
            gameDialog.close();
            if (action.run) action.run();
        });
        container.append(button);
    });
    if (!gameDialog.open) gameDialog.showModal();
}

function showCompletion() {
    const category = catalogue.categories.find(item => item.id === progress.category);
    openDialog("Výborne!", `Dokončil si všetky úlohy (${currentProgress().order.length}) v kategórii ${category.name}.`, "check", [
        { label: "Vybrať kategóriu", run: () => {
            const other = document.querySelector(`#categories button:not([data-category="${progress.category}"])`);
            other.focus();
            feedback.textContent = "Vyber si kategóriu v hornom menu.";
        } },
        { label: "Hrať znova", run: () => {
            const saved = currentProgress();
            saved.order = shuffled(saved.order);
            saved.index = 0;
            saved.taskId = null;
            saved.solved = false;
            loadCurrentTask();
        } }
    ]);
}

function nextTask() {
    stopRecording();
    const saved = currentProgress();
    saved.index++;
    saved.solved = false;
    loadCurrentTask();
}

function checkSolution() {
    const saved = currentProgress();
    if (saved.index >= saved.order.length) return showCompletion();
    if (saved.solved) return nextTask();
    if (!isSolved(currentMatches, currentPuzzle, currentTask.moves)) {
        feedback.textContent = "Ešte to nie je správne. Skontroluj rozloženie aj počet presunutých zápaliek a skús to znova.";
        return;
    }
    saved.solved = true;
    selectedMatch = -1;
    if (saved.index === saved.order.length - 1) {
        // The task count also marks the completed category.
        saved.index = saved.order.length;
        showCompletion();
    } else {
        openDialog("Správne!", "Úloha je vyriešená.", "check", [{ label: "Ďalšia úloha", run: nextTask }]);
    }
    updateGameButtons();
    drawBoard();
    saveProgress();
}

// Switch between the game and instructions without reloading.
function renderPage() {
    const help = location.hash === "#navod";
    if (help) stopRecording();
    document.querySelector("#game-view").hidden = help;
    document.querySelector("#help-view").hidden = !help;
    document.querySelector("#record-button").hidden = help;
    const link = document.querySelector("#help-link");
    link.textContent = help ? "Späť do hry" : "Návod";
    link.href = help ? "#hra" : "#navod";
    if (!help && currentPuzzle) drawBoard();
}

async function startGame() {
    renderPage();
    const status = document.querySelector("#load-status");
    try {
        const response = await fetch("data/tasks.json");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        catalogue = await response.json();
        // Load task IDs before checking saved progress.
        loadProgress();
        renderCategories();
        loadCurrentTask();
        document.querySelector("#total-tasks").textContent = catalogue.tasks.length;
        document.querySelector("#game-content").hidden = false;
        status.hidden = true;
        setupRecording();
        setupSensors();
    } catch {
        status.textContent = location.protocol === "file:"
            ? "Otvor hru cez Live Server alebo HTTP(S) server, nie priamo ako súbor."
            : "Hlavolamy sa nepodarilo načítať. Skontroluj pripojenie a skús to znova.";
        document.querySelector("#retry-button").hidden = false;
    }
}

checkButton.addEventListener("click", checkSolution);
document.querySelector("#hint-button").addEventListener("click", () => {
    openDialog("Nápoveda", currentTask.hint, "bulb", [{ label: "Pokračovať" }]);
});
document.querySelector("#reset-button").addEventListener("click", resetTask);
document.querySelector("#solution-button").addEventListener("click", () => showingSolution ? hideSolution() : showSolution());
document.querySelector("#return-button").addEventListener("click", hideSolution);
document.querySelector("#dialog-close").addEventListener("click", () => gameDialog.close());
gameDialog.addEventListener("close", () => document.querySelector("#recording-preview").pause());
document.querySelector("#retry-button").addEventListener("click", () => location.reload());
window.addEventListener("hashchange", renderPage);
window.addEventListener("pagehide", saveProgress);
// Adjust match positions when the screen layout changes.
mobileLayout.addEventListener("change", () => {
    if (!currentTask) return;
    stopRecording();
    saveProgress();
    loadCurrentTask();
});
// Save progress when the player switches apps.
document.addEventListener("visibilitychange", () => { if (document.hidden) saveProgress(); });
document.addEventListener("DOMContentLoaded", startGame);