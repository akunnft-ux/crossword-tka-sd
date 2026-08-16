"use strict";

const WORDS = [
  { id: 1,  word: "BUMI",     clue: "Planet tempat tinggal kita", dir: "down",   row: 1, col: 2 },
  { id: 2,  word: "HIDUP",    clue: 'Lawan kata dari "mati"', dir: "down",   row: 2, col: 9 },
  { id: 3,  word: "MATAHARI", clue: "Benda langit yang menjadi sumber cahaya dan panas pada siang hari", dir: "across", row: 3, col: 2 },
  { id: 4,  word: "AIR",      clue: "Zat cair yang sangat penting bagi kehidupan", dir: "down",   row: 3, col: 5 },
  { id: 5,  word: "HEWAN",    clue: "Makhluk hidup yang bisa bergerak, makan, dan bernapas", dir: "down",   row: 3, col: 6 },
  { id: 6,  word: "API",      clue: "Benda yang menghasilkan panas dan bisa membakar", dir: "across", row: 4, col: 3 },
  { id: 7,  word: "BULAN",    clue: "Benda langit yang terlihat indah pada malam hari", dir: "down",   row: 5, col: 3 },
  { id: 8,  word: "BUNGA",    clue: "Bagian tumbuhan yang indah dan berwarna-warni", dir: "across", row: 6, col: 2 },
  { id: 9,  word: "LANGIT",   clue: "Tempat bintang, bulan, dan awan berada", dir: "across", row: 7, col: 4 },
  { id: 10, word: "TANAH",    clue: "Tempat tumbuhan berpijak dan menyerap air", dir: "across", row: 8, col: 2 }
];

const wordById = new Map(WORDS.map((w) => [w.id, w]));

function wordCells(w) {
  const cells = [];
  for (let i = 0; i < w.word.length; i++) {
    cells.push({
      r: w.row + (w.dir === "down" ? i : 0),
      c: w.col + (w.dir === "across" ? i : 0)
    });
  }
  return cells;
}

const keyOf = (r, c) => r + "," + c;

// Build grid map, per-cell word membership, bounds
const gridMap = new Map();
const cellWords = new Map();
let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;

WORDS.forEach((w) => {
  wordCells(w).forEach(({ r, c }, i) => {
    const key = keyOf(r, c);
    gridMap.set(key, w.word[i]);
    if (!cellWords.has(key)) cellWords.set(key, []);
    cellWords.get(key).push(w.id);
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
    minC = Math.min(minC, c);
    maxC = Math.max(maxC, c);
  });
});

const ROWS = maxR - minR + 1;
const COLS = maxC - minC + 1;

// Cell number assignment (by position: row then col)
const cellNumbers = new Map();
WORDS.forEach((w) => {
  const start = keyOf(w.row, w.col);
  if (!cellNumbers.has(start)) cellNumbers.set(start, w.id);
});

// State
const state = {
  currentWordId: null,
  score: 0,
  hintsLeft: 3,
  lastClickedKey: null
};
const doneWords = new Set();
const cells = new Map();

const board = document.getElementById("board");
const clueAcross = document.getElementById("clueAcross");
const clueDown = document.getElementById("clueDown");
const scoreText = document.getElementById("scoreText");
const hintText = document.getElementById("hintText");
const toastEl = document.getElementById("toast");
const winModal = document.getElementById("winModal");
const confettiLayer = document.getElementById("confettiLayer");

let toastTimer = null;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
}

// ---------- Render board ----------
board.style.gridTemplateColumns = `repeat(${COLS}, minmax(0, 1fr))`;

for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const key = keyOf(r + minR, c + minC);
    const isCell = gridMap.has(key);
    const wrapper = document.createElement("div");
    wrapper.className = isCell ? "cell" : "block";

    if (isCell) {
      const num = cellNumbers.get(key);
      if (num) {
        const span = document.createElement("span");
        span.className = "cell-num";
        span.textContent = num;
        wrapper.appendChild(span);
      }

      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 1;
      input.autocomplete = "off";
      input.autocapitalize = "characters";
      input.spellcheck = false;
      input.setAttribute("aria-label", "Kotak huruf");
      input.dataset.r = r + minR;
      input.dataset.c = c + minC;
      wrapper.appendChild(input);
      cells.set(key, input);

      input.addEventListener("input", () => handleInput(input, r + minR, c + minC));
      input.addEventListener("keydown", (e) => handleKeyDown(e, input, r + minR, c + minC));
      wrapper.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        selectCell(r + minR, c + minC, true);
        input.focus({ preventScroll: false });
      });
    }

    board.appendChild(wrapper);
  }
}

// Scale font size to cell size
function scaleCellFont() {
  const first = board.querySelector(".cell input");
  if (!first) return;
  const size = first.getBoundingClientRect().width;
  if (size <= 0) return;
  const letterSize = Math.max(14, Math.floor(size * 0.52));
  const numSize = Math.max(9, Math.floor(size * 0.18));
  board.querySelectorAll(".cell input").forEach((i) => (i.style.fontSize = letterSize + "px"));
  board.querySelectorAll(".cell-num").forEach((n) => (n.style.fontSize = numSize + "px"));
}
let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(scaleCellFont, 150);
});

// ---------- Render clues ----------
function buildClueList(container, dir) {
  WORDS.filter((w) => w.dir === dir)
    .sort((a, b) => a.id - b.id)
    .forEach((w) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "clue";
      btn.dataset.id = w.id;
      btn.innerHTML = `<span class="clue-num">${w.id}</span><span>${w.clue} <span class="clue-word">(${w.word.length} huruf)</span></span>`;
      btn.addEventListener("click", () => {
        const first = wordCells(w)[0];
        selectCell(first.r, first.c, false);
        cells.get(keyOf(first.r, first.c)).focus();
      });
      li.appendChild(btn);
      container.appendChild(li);
    });
}
buildClueList(clueAcross, "across");
buildClueList(clueDown, "down");

// ---------- Word / cell selection ----------
function setCurrentWord(id) {
  if (state.currentWordId === id) return;
  document.querySelectorAll(".cell-word-active").forEach((el) => el.classList.remove("cell-word-active"));
  document.querySelectorAll(".cell-word-faint").forEach((el) => el.classList.remove("cell-word-faint"));
  state.currentWordId = id;

  if (id) {
    const w = wordById.get(id);
    wordCells(w).forEach(({ r, c }) => {
      const el = cells.get(keyOf(r, c));
      if (el) el.classList.add("cell-word-active");
    });
    // highlight crossing cells from other words
    wordCells(w).forEach(({ r, c }) => {
      cellWords.get(keyOf(r, c)).forEach((oid) => {
        if (oid !== id) {
          wordCells(wordById.get(oid)).forEach(({ r: rr, c: cc }) => {
            const el = cells.get(keyOf(rr, cc));
            if (el) el.classList.add("cell-word-faint");
          });
        }
      });
    });
  }

  document.querySelectorAll(".clue").forEach((btn) => {
    btn.classList.toggle("clue-active", Number(btn.dataset.id) === id);
  });
}

function selectCell(r, c, isPointer) {
  const key = keyOf(r, c);
  const ids = cellWords.get(key);
  if (!ids) return;

  let id = null;
  const across = ids.find((i) => wordById.get(i).dir === "across");
  const down = ids.find((i) => wordById.get(i).dir === "down");

  if (isPointer && state.lastClickedKey === key && ids.length > 1) {
    // second click on same crossing cell -> toggle direction
    id = state.currentWordId === across ? down : across;
  } else {
    id = across || down;
  }

  state.lastClickedKey = isPointer ? key : null;
  setCurrentWord(id);
}

// ---------- Input handling ----------
function handleInput(input, r, c) {
  const key = keyOf(r, c);
  const answer = gridMap.get(key);
  const value = input.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(-1);
  input.value = value;

  input.classList.remove("cell-flash-wrong", "cell-revealed");
  if (value) {
    input.classList.toggle("cell-letter-ok", value === answer);
    input.classList.toggle("cell-letter-bad", value !== answer);
  } else {
    input.classList.remove("cell-letter-ok", "cell-letter-bad");
  }

  // recheck any word touching this cell
  cellWords.get(key).forEach((id) => recheckWord(id));

  if (value && state.currentWordId) {
    const w = wordById.get(state.currentWordId);
    const idx = wordCells(w).findIndex((p) => p.r === r && p.c === c);
    if (idx >= 0) {
      const next = wordCells(w)[idx + 1];
      if (next) {
        selectCell(next.r, next.c, false);
        cells.get(keyOf(next.r, next.c)).focus();
      }
    }
  }
}

function handleKeyDown(e, input, r, c) {
  const nav = {
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0]
  };

  if (nav[e.key]) {
    e.preventDefault();
    let nr = r + nav[e.key][0];
    let nc = c + nav[e.key][1];
    while (cells.has(keyOf(nr, nc))) {
      selectCell(nr, nc, false);
      cells.get(keyOf(nr, nc)).focus();
      return;
    }
    return;
  }

  if (e.key === "Backspace" || e.key === "Delete") {
    if (!input.value && state.currentWordId) {
      e.preventDefault();
      const w = wordById.get(state.currentWordId);
      const idx = wordCells(w).findIndex((p) => p.r === r && p.c === c);
      if (idx > 0) {
        const prev = wordCells(w)[idx - 1];
        const prevInput = cells.get(keyOf(prev.r, prev.c));
        prevInput.value = "";
        prevInput.classList.remove("cell-letter-ok", "cell-letter-bad");
        selectCell(prev.r, prev.c, false);
        prevInput.focus();
        cellWords.get(keyOf(prev.r, prev.c)).forEach((id) => recheckWord(id));
      }
    }
  }
}

// ---------- Word status ----------
function wordFullyCorrect(id) {
  const w = wordById.get(id);
  return wordCells(w).every(({ r, c }) => cells.get(keyOf(r, c)).value === gridMap.get(keyOf(r, c)));
}

function recheckWord(id) {
  const isDone = wordFullyCorrect(id);
  const wasDone = doneWords.has(id);

  if (isDone && !wasDone) {
    doneWords.add(id);
    state.score++;
    wordCells(wordById.get(id)).forEach(({ r, c }) => {
      const el = cells.get(keyOf(r, c));
      el.classList.remove("cell-letter-ok", "cell-letter-bad");
      el.classList.add("cell-done");
    });
    showToast(`Kata "${wordById.get(id).word}" selesai!`);
  } else if (!isDone && wasDone) {
    doneWords.delete(id);
    state.score--;
    wordCells(wordById.get(id)).forEach(({ r, c }) => cells.get(keyOf(r, c)).classList.remove("cell-done"));
  }

  updateScore();
  if (state.score === WORDS.length) onWin();
}

function updateScore() {
  scoreText.textContent = state.score;
}

function updateHintDisplay() {
  hintText.textContent = state.hintsLeft;
}

// ---------- Actions ----------
document.getElementById("btnCheck").addEventListener("click", checkAll);
document.getElementById("btnHint").addEventListener("click", useHint);
document.getElementById("btnReset").addEventListener("click", resetGame);
document.getElementById("btnPlayAgain").addEventListener("click", () => {
  winModal.classList.add("hidden");
  resetGame();
});

function checkAll() {
  let wrong = 0;
  let empty = 0;

  WORDS.forEach((w) => {
    if (doneWords.has(w.id)) return;
    wordCells(w).forEach(({ r, c }) => {
      const el = cells.get(keyOf(r, c));
      const val = el.value;
      const answer = gridMap.get(keyOf(r, c));
      if (val && val !== answer) {
        wrong++;
        el.classList.add("cell-flash-wrong");
        setTimeout(() => el.classList.remove("cell-flash-wrong"), 500);
      } else if (!val) {
        empty++;
      }
    });
  });

  if (wrong > 0) {
    showToast("Masih ada huruf yang salah. Coba lagi, kamu pasti bisa!");
  } else if (empty > 0) {
    showToast("Ayo isi semua kotak yang masih kosong!");
  } else {
    showToast("Semua jawaban sudah benar!");
  }
}

function useHint() {
  if (state.hintsLeft <= 0) {
    showToast("Petunjuk sudah habis!");
    return;
  }

  let target = null;

  if (state.currentWordId && !doneWords.has(state.currentWordId)) {
    const w = wordById.get(state.currentWordId);
    const empties = wordCells(w).filter(({ r, c }) => cells.get(keyOf(r, c)).value !== gridMap.get(keyOf(r, c)));
    if (empties.length) target = empties[0];
  }

  if (!target) {
    const candidates = WORDS.filter((w) => !doneWords.has(w.id))
      .flatMap((w) => wordCells(w).filter(({ r, c }) => cells.get(keyOf(r, c)).value !== gridMap.get(keyOf(r, c))));
    if (candidates.length) target = candidates[Math.floor(Math.random() * candidates.length)];
  }

  if (target) {
    const el = cells.get(keyOf(target.r, target.c));
    el.value = gridMap.get(keyOf(target.r, target.c));
    el.classList.add("cell-revealed");
    el.classList.remove("cell-letter-ok", "cell-letter-bad");
    cellWords.get(keyOf(target.r, target.c)).forEach((id) => recheckWord(id));
    state.hintsLeft--;
    updateHintDisplay();
    showToast("Satu huruf terbantu. Gunakan dengan bijak!");
  } else {
    showToast("Semua sudah terisi benar!");
  }
}

function resetGame() {
  cells.forEach((el) => {
    el.value = "";
    el.classList.remove("cell-done", "cell-letter-ok", "cell-letter-bad", "cell-revealed", "cell-flash-wrong");
  });
  doneWords.clear();
  state.score = 0;
  state.hintsLeft = 3;
  state.currentWordId = null;
  state.lastClickedKey = null;
  setCurrentWord(null);
  updateScore();
  updateHintDisplay();
}

// ---------- Win ----------
function onWin() {
  setTimeout(() => {
    winModal.classList.remove("hidden");
    burstConfetti();
  }, 350);
}

function burstConfetti() {
  const colors = ["#6366f1", "#38bdf8", "#22c55e", "#facc15", "#f472b6", "#fb923c"];
  for (let i = 0; i < 90; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti";
    piece.style.left = Math.random() * 100 + "%";
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = Math.random() * 0.6 + "s";
    piece.style.animationDuration = 1.6 + Math.random() * 1.4 + "s";
    piece.style.transform = "rotate(" + Math.random() * 360 + "deg)";
    confettiLayer.appendChild(piece);
    setTimeout(() => piece.remove(), 3600);
  }
}

// ---------- Init ----------
updateScore();
updateHintDisplay();
scaleCellFont();
