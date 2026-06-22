// Tic Tac Territory - Core Logic

// --- STATE MANAGEMENT ---// --- FIREBASE ---
const firebaseConfig = {
  apiKey: "1:754183730266:web:3f4461dfb247d7fc6c5463",
  authDomain: "tic-tac-toe-de240.firebaseapp.com",
  databaseURL: "https://tic-tac-toe-de240-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tic-tac-toe-de240",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
function setRoomStatus(text) {
  document.getElementById("room-status").innerText = text;
}


// =============== SOUND EFFECT =====================
const sounds = {
  click: document.getElementById("sound-click"),
  move: document.getElementById("sound-move"),
  win: document.getElementById("sound-win"),
  draw: document.getElementById("sound-draw"),
  time: document.getElementById("sound-time"),
  lose: document.getElementById("sound-lose"),

};

function playSound(sound) {
  if (!sound) return;
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

// ================= MULTIPLAYER FUNCTIONS =================

function showLeaveRoom() {

    
  // 🔒 Sirf HOST ko button dikhe
  if (playerSymbol === "X") {
    document.getElementById("leave-room-group")?.classList.remove("hidden");
  }
}
function hideLeaveRoom() {
  document.getElementById("leave-room-group")?.classList.add("hidden");
}


function setRoomStatus(text) {
  document.getElementById("room-status").innerText = text;
}

let roomId = null;
let playerSymbol = null;
let isHost = false;   // 🔥 HOST / JOINER ROLE TRACK



function createRoom() {

if (UI.opponentSelect.value !== "online") {
  alert("Please select ONLINE MULTIPLAYER mode first");
  return;
}


  roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  isHost = true;   // 🔥 THIS CLIENT IS HOST


// 🔥 HOST SYMBOL (from faction selection)
playerSymbol = state.playerSymbol || "X";
state.playerSymbol = playerSymbol; // 🔥 FORCE sync


db.ref("rooms/" + roomId).set({
  board: Array(9).fill(""),
  turn: "X",
  winner: null,

  hostSymbol:null,   // 🔥 SAVE HOST SYMBOL
  currentTurn: "X", // 🔥 X ALWAYS STARTS



  settings: {
    mode: state.mode,
    timeMode: state.timeMode,
    series: state.series
  }
});


  setRoomStatus("ROOM: " + roomId + " (HOST)");
  alert("Room Created: " + roomId);

  // 🔓 ENABLE SYMBOL SELECTION AFTER ROOM CREATE (HOST)
UI.factionBtns.forEach(btn => {
  btn.disabled = false;
});

  showLeaveRoom();

  listenRoom();
}
function joinRoom() {
    isHost = false;   // 🔥 THIS CLIENT IS JOINER\
  const input = document.getElementById("roomInput").value.trim().toUpperCase();
  if (!input) {
    alert("Enter Room Code");
    return;
  }

  roomId = input;
  const roomRef = db.ref("rooms/" + roomId);

  roomRef.once("value").then(snapshot => {
    if (!snapshot.exists()) {
      alert("Room not found!");
      roomId = null;
      return;
    }

    const data = snapshot.val();

    // 🔥 PART 2 — LISTEN IF HOST CLOSES ROOM
db.ref("rooms/" + roomId).on("value", snap => {
  if (!snap.exists()) {
    alert("Host left the room");

    // 🔄 Joiner cleanly exit without refresh
    closeRoom();
  }
});


// 🔥 LISTEN TO HOST SYMBOL (EVERY ROUND)

db.ref("rooms/" + roomId + "/hostSymbol").on("value", snap => {
  const hostSymbol = snap.val();
  if (!hostSymbol) return;

  // ✅ JOINER ALWAYS GETS OPPOSITE (EVERY ROUND)
  playerSymbol = hostSymbol === "X" ? "O" : "X";
  state.playerSymbol = playerSymbol;

  // 🔒 Joiner UI sync
  UI.factionBtns.forEach(btn => {
    btn.disabled = true;
    btn.classList.toggle("active", btn.dataset.symbol === playerSymbol);
  });

  setRoomStatus("ROOM: " + roomId + " (JOINED)");
});

listenRoom();

  }).catch(err => {
    console.error(err);
    alert("Failed to join room");
    roomId = null;
  });


}
function listenRoom() {
  db.ref("rooms/" + roomId + "/move").on("value", snap => {
    const move = snap.val();
    if (!move) return;

    const { landIndex, cellIndex, player } = move;

    if (state.boards[landIndex][cellIndex]) return;
    
    playSound(sounds.move);
    makeMove(landIndex, cellIndex, player);
  });
 
  // 🔥 STEP 2 — HOST NEW GAME LISTENER (ADD ONLY THIS)
  db.ref("rooms/" + roomId + "/newGame").on("value", snap => {
    if (!snap.exists()) return;    
    startNewGame();
  });

// 🔥 HOST SETTINGS → JOINER AUTO SYNC (FINAL)
db.ref("rooms/" + roomId + "/settings").on("value", snap => {
  if (!snap.exists()) return;

  // ❌ host apni hi settings dobara apply na kare
  if (isHost) return;

  // ✅ joiner always sync
  applyRoomSettings(snap.val());
});

}
function sendOnlineMove(landIndex, cellIndex) {
  db.ref("rooms/" + roomId + "/move").set({
    landIndex,
    cellIndex,
    player: playerSymbol,
    time: Date.now()
  });
}
const state = {
    mode: "territory",   // 🔥 DEFAULT = TERRITORY
    opponent: "human", // 'human' | 'ai'
    aiDifficulty: "medium", // 'easy'|'medium'|'hard'|'impossible'
    series: "free", // 'free'|'3'|'10'
    timeMode: false,

    currentPlayer: "X",
    playerSymbol: "X", // Human player symbol

    boards: [], // Array of 9 (or 2) board states. Each is array of 9 cells.
    boardWinners: [], // Array of owner of each land (null, 'X', 'O')
    activeLands: [], // Which lands are playable? (In this game: All non-won lands are playable usually, unless rule specific)
    // Rule clarification: "Players can play on either land" (Normal). "Territory Mode... Winning a land claims it".
    // Standard rule: Play anywhere that isn't full/won.

    timer: 10,
    timerInterval: null,

    scores: { X: 0, O: 0, draw: 0 },
    round: 1,
    gameActive: false,
    isAiTurn: false,
};

const UI = {
    gameContainer: document.getElementById("game-container"),
    modeSelect: document.getElementById("mode-select"),
    opponentSelect: document.getElementById("opponent-select"),
    aiDifficultySelect: document.getElementById("ai-difficulty"),
    aiDifficultyGroup: document.getElementById("ai-difficulty-group"),
    seriesSelect: document.getElementById("series-select"),
    newGameBtn: document.getElementById("new-game-btn"),
    factionBtns: document.querySelectorAll(".faction-btn"),
    playerNameInput: document.getElementById("player-name"),
    timeModeCheck: document.getElementById("time-mode-check"),

    scoreX: document.getElementById("score-x"),
    scoreO: document.getElementById("score-o"),
    scoreDraw: document.getElementById("score-draw"),
    currentRound: document.getElementById("current-round"),
    seriesTarget: document.getElementById("series-target"),

    logContainer: document.getElementById("log-container"),
    statusMessage: document.getElementById("game-status"),

    timeOverlay: document.getElementById("time-mode-overlay"),
    timerFill: document.getElementById("timer-fill"),
    timerSeconds: document.getElementById("timer-seconds"),

    modal: document.getElementById("modal-overlay"),
    modalTitle: document.getElementById("modal-title"),
    modalMessage: document.getElementById("modal-message"),
    modalCloseBtn: document.getElementById("modal-close-btn"),
};

// --- INITIALIZATION ---
function init() {
    setupEventListeners();
    resetSeries();

    // 🔥 SYNC DEFAULT MODE WITH UI
    UI.modeSelect.value = "territory";
    UI.factionBtns.forEach(btn => btn.disabled = true);

    // 🔒 DEFAULT: AI difficulty hidden
    UI.aiDifficultyGroup.classList.add("hidden");

    startNewGame();
}

    

// 🔊 Button click sound (ALL buttons)
document.querySelectorAll("button").forEach(btn => {
  btn.addEventListener("click", () => {
    playSound(sounds.click);
  });
}); 

// 🔊 Select change sound (mode / opponent / series)
document.querySelectorAll("select").forEach(select => {
  select.addEventListener("change", () => {
    playSound(sounds.click);
  });
});

document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
  cb.addEventListener("change", () => {
    playSound(sounds.click);
  });
});

function closeRoom() {
    isHost = false;


  if (!roomId) return;
  isClosingRoom = true;

  console.log("Closing room:", roomId);

  // 🔥 CLEAR ROOM STATUS (HOST + JOINER)
  setRoomStatus("NOT CONNECTED");

  // 🔥 Firebase listeners OFF
  db.ref("rooms/" + roomId + "/move").off();
  db.ref("rooms/" + roomId + "/hostSymbol").off();
  db.ref("rooms/" + roomId + "/newGame").off();
  db.ref("rooms/" + roomId).off();   // 🔥 IMPORTANT: ROOT ROOM LISTENER OFF


  // 🔥 HOST deletes room
  if (playerSymbol === "X") {
    db.ref("rooms/" + roomId).remove();
  }

  // 🔄 Reset multiplayer state
  roomId = null;
  playerSymbol = null;

  // 🔄 Reset UI
  hideLeaveRoom();

  // 🔓 Enable faction buttons for offline / CPU
  UI.factionBtns.forEach(btn => {
    btn.disabled = false;
    btn.classList.remove("active");
  });

  // 🔄 Back to normal offline game
  state.opponent = "human";
  UI.opponentSelect.value = "human";

  // 🔄 HIDE AI DIFFICULTY WHEN EXITING ROOM
  UI.aiDifficultyGroup.classList.add("hidden");


  isClosingRoom = false;


// 🔥 CLEAR TURN COLOR CLASSES (IMPORTANT FIX)
UI.gameContainer.classList.remove("turn-X", "turn-O");


 // 🔄 Reset opponent & mode
state.opponent = "human";
UI.opponentSelect.value = "human";

state.mode = "normal";
UI.modeSelect.value = "normal";

// 🔥 HARD STOP game state
state.gameActive = false;

// 🔄 BACK TO NORMAL OFFLINE GAME
state.opponent = "human";
UI.opponentSelect.value = "human";

state.mode = "territory";        // game pehle jaise start ho
UI.modeSelect.value = "territory";

UI.factionBtns.forEach(btn => {
  btn.disabled = false;
  btn.classList.remove("active");
});
// 🔥 RESET SYMBOL FOR AI / OFFLINE (CRITICAL FIX)
playerSymbol = state.playerSymbol;


{

  startNewGame();
}

  hideLeaveRoom();
  setTimeout(() => {
  isClosingRoom = false;
}, 0);

setRoomStatus("NOT CONNECTED");   // 🔥 FINAL FORCE RESET

}


function setupEventListeners() {

UI.modeSelect.addEventListener("change", (e) => {
    state.mode = e.target.value;

    // 🔥 HOST → sync settings
    if (roomId && playerSymbol === "X") {
        db.ref("rooms/" + roomId + "/settings").set({
            mode: state.mode,
            timeMode: state.timeMode,
            series: state.series
        });
    }

    startNewGame();
});

// 🔥 OPPONENT SELECT (VS CPU / LOCAL / ONLINE)
UI.opponentSelect.addEventListener("change", (e) => {

    // ignore during room close
    if (typeof isClosingRoom !== "undefined" && isClosingRoom) return;

    const newOpponent = e.target.value;
    // 🔥 MAP CPU → AI
    state.opponent = newOpponent === "cpu" ? "ai" : newOpponent;


    // Show / hide AI difficulty (CPU = AI)
if (state.opponent === "ai") {
    UI.aiDifficultyGroup.classList.remove("hidden");
} else {
    UI.aiDifficultyGroup.classList.add("hidden");
}
// 🔥 AI MODE: ENABLE X / O SELECTION
if (state.opponent === "ai" && !roomId) {
    UI.factionBtns.forEach(btn => btn.disabled = false);
}


    startNewGame();
});


    UI.aiDifficultySelect.addEventListener("change", (e) => {
        state.aiDifficulty = e.target.value;
    });

    UI.seriesSelect.addEventListener("change", (e) => {
        state.series = e.target.value;
        // 🔥 HOST → sync settings
     if (roomId && playerSymbol === "X") {
      db.ref("rooms/" + roomId + "/settings").set({
        mode: state.mode,
        timeMode: state.timeMode,
        series: state.series
    });
}

        resetSeries();
        startNewGame();
    });

    UI.timeModeCheck.addEventListener("change", (e) => {
    state.timeMode = e.target.checked;

      // 🔥 HOST → sync settings
     if (roomId && playerSymbol === "X") {
      db.ref("rooms/" + roomId + "/settings").set({
        mode: state.mode,
        timeMode: state.timeMode,
        series: state.series
    });
}

    if (state.timeMode) {
        UI.timeOverlay.classList.remove("hidden");

        // ✅ Timer + sound ko restartTimer handle karega
        resetTimer();

    } else {
        UI.timeOverlay.classList.add("hidden");

        // 🔇 Sound stop
        sounds.time.pause();
        sounds.time.currentTime = 0;
        sounds.time.loop = false;

        // ⏱️ Timer stop
        clearInterval(state.timerInterval);
    }
    
});
    UI.newGameBtn.addEventListener("click", () => {
        if (isSeriesOver()) {
            resetSeries();
        }
        
        // 🟢 ONLINE MODE: notify joiner
     if (roomId && playerSymbol === "X") {
        db.ref("rooms/" + roomId + "/newGame").set(Date.now());
       }

        startNewGame();
    });

  UI.factionBtns.forEach((btn) => {
  btn.addEventListener("click", () => {


    UI.factionBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    playerSymbol = btn.dataset.symbol;
    state.playerSymbol = playerSymbol;

    // 🔥 MOST IMPORTANT FIX: SAVE HOST SYMBOL
    // 🔥 ONLINE ONLY: sync symbol to Firebase
if (roomId) {
  db.ref("rooms/" + roomId + "/hostSymbol").set(playerSymbol);
}

    startNewGame();
  });
});


    UI.playerNameInput.addEventListener("change", (e) => {
        log("system", `OPERATOR CALLSIGN UPDATED: ${e.target.value}`);
    });


    // 🔥 ACKNOWLEDGE BUTTON = NEW GAME
UI.modalCloseBtn.addEventListener("click", () => {
    console.log("ACKNOWLEDGE CLICKED");

    // Modal band
    UI.modal.classList.add("hidden");

    // Next round
    state.round++;

    // 🟢 ONLINE MULTIPLAYER
    if (roomId) {
        // ✅ Sirf HOST new game start kare
        if (playerSymbol === "X") {
            startNewGame(); // HOST ka game turant
            db.ref("rooms/" + roomId + "/newGame").set(Date.now()); // JOINER ko signal
        }
        return; // JOINER yahin rukega
    }

    // 🟢 OFFLINE / LOCAL / AI
    startNewGame();
});

}

// --- CORE GAME LOGIC ---

function resetSeries() {
    state.scores = { X: 0, O: 0, draw: 0 };
    state.round = 1;
    updateScoreboard();
    log("system", "SERIES RESET");
}

function isSeriesOver() {
    if (state.series === "free") return false;
    const target = parseInt(state.series);
    const winThreshold = Math.ceil(target / 2);

    // Best of X logic
    if (state.scores.X >= winThreshold) return "X";
    if (state.scores.O >= winThreshold) return "O";
    if (state.round > target) {
        // Tie breaker or end
        if (state.scores.X > state.scores.O) return "X";
        if (state.scores.O > state.scores.X) return "O";
        return "DRAW";
    }
    return false;
}

function startNewGame() {

    // 🔥 FINAL OPPONENT SYNC (CRITICAL FIX)
const selectedOpponent = UI.opponentSelect.value;
state.opponent = selectedOpponent === "cpu" ? "ai" : selectedOpponent;

    clearInterval(state.timerInterval);
    state.gameActive = true;
    state.isAiTurn = false;
    state.timer = 10;

// 🔒 ONLINE MULTIPLAYER ONLY: lock symbol
if (roomId && state.opponent === "online") {
    state.playerSymbol = playerSymbol;
}

// ✅ RULE: X ALWAYS STARTS (ONLINE + OFFLINE)
state.currentPlayer = "X";


    // Init Boards
   const landCount = state.mode === "territory" ? 9 : 1;



    state.boards = Array(landCount)
        .fill(null)
        .map(() => Array(9).fill(null));
    state.boardWinners = Array(landCount).fill(null);

    renderBoard();
    updateStatus();
    log("event", `NEW GAME INITIATED - ${state.mode.toUpperCase()} MODE`);



    if (state.opponent === "ai" && state.currentPlayer !== state.playerSymbol) {
        processAiTurn();
    }

    if (state.timeMode) startTimer();
}

function renderBoard() {
    UI.gameContainer.innerHTML = "";
    UI.gameContainer.className = `game-board-container mode-${state.mode}`;

    state.boards.forEach((board, landIndex) => {
        const landEl = document.createElement("div");
        landEl.className = "land";
        landEl.dataset.landIndex = landIndex;

        // Add cells
        board.forEach((cell, cellIndex) => {
            const cellEl = document.createElement("div");
            cellEl.className = `cell ${cell || ""}`;
            cellEl.dataset.cellIndex = cellIndex;
            cellEl.dataset.landIndex = landIndex;
            cellEl.onclick = () => handleCellClick(landIndex, cellIndex);
            if (cell) cellEl.textContent = cell;
            landEl.appendChild(cellEl);
        });

        // Overlay for winner
        const overlay = document.createElement("div");
        overlay.className = "land-overlay";
        if (state.boardWinners[landIndex]) {
            landEl.classList.add(`winner-${state.boardWinners[landIndex]}`);
            overlay.textContent = state.boardWinners[landIndex];
        }
        landEl.appendChild(overlay);

        UI.gameContainer.appendChild(landEl);
    });
}
function handleCellClick(landIndex, cellIndex) {
    if (!state.gameActive) return;
    if (state.isAiTurn) return;
    if (state.boardWinners[landIndex]) return;
    if (state.boards[landIndex][cellIndex]) return;

    // 🟢 ONLINE MODE (room created / joined)
    if (roomId) {
        if (state.currentPlayer !== playerSymbol) return;
        sendOnlineMove(landIndex, cellIndex);
        return;
    }

    // 🟢 NORMAL / LOCAL MODE
    playSound(sounds.move);
    makeMove(landIndex, cellIndex, state.currentPlayer);
}

function makeMove(landIndex, cellIndex, player) {
    // Update state
    state.boards[landIndex][cellIndex] = player;

    // Render update (optimized: just update the cell class/text)
    const cellEl = document.querySelector(
        `.cell[data-land-index="${landIndex}"][data-cell-index="${cellIndex}"]`,
    );
    if (cellEl) {
        cellEl.classList.add(player);
        cellEl.textContent = player;
        cellEl.classList.add("taken");
    }

    // Check Land Win
    checkLandWin(landIndex, player);

    // Check Global Win
    if (checkGlobalWin()) {
        endGame(checkGlobalWin());
        return;
    }

    // Switch Turn
    state.currentPlayer = state.currentPlayer === "X" ? "O" : "X";
    updateStatus();

    // Reset Timer if in time mode
    if (state.timeMode) resetTimer();

    // AI Turn
    if (
        state.gameActive &&
        state.opponent === "ai" &&
        state.currentPlayer !== state.playerSymbol
    ) {
        state.isAiTurn = true;
        // Visible delay
        setTimeout(() => processAiTurn(), 600);
    } else {
        state.isAiTurn = false;
    }
}

function checkLandWin(landIndex, player) {
    const board = state.boards[landIndex];
    const winPatterns = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8], // Rows
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8], // Cols
        [0, 4, 8],
        [2, 4, 6], // Diagonals
    ];

    let won = false;
    for (const pattern of winPatterns) {
        if (pattern.every((idx) => board[idx] === player)) {
            won = true;
            break;
        }
    }

    if (won) {
        state.boardWinners[landIndex] = player;
        log(player, `SECURED LAND SECTOR ${landIndex + 1}`);
        renderBoard(); // Re-render to show land overlay
    } else if (board.every((c) => c !== null)) {
        // Draw in land
        state.boardWinners[landIndex] = "DRAW";
        log("event", `LAND SECTOR ${landIndex + 1} CONTESTED (DRAW)`);
        renderBoard();
    }
}

function checkGlobalWin() {
    // Normal Mode: Win by winning most lands (or if logic says classic tic-tac-toe on meta... but we have 2 lands)
    // Req: "Win logic is classic tic-tac-toe" for Normal (2 lands).
    // Wait, standard tic-tac-toe on 2 boards is impossible.
    // Interpretation: Normal Mode = just 2 boards. You play until boards are full/won.
    // If you win a board, you get a point. Most points wins.

    if (state.mode === "normal") {
        const winner = state.boardWinners[0];
    if (winner) return winner;
    return false;
    }

    // Territory Mode (9 lands)
    // Win by 3 lands in a row OR most lands if all full
    const wins = state.boardWinners;
    const winPatterns = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
    ];

    // Check 3 in a row
    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (
            wins[a] &&
            wins[a] !== "DRAW" &&
            wins[a] === wins[b] &&
            wins[a] === wins[c]
        ) {
            return wins[a];
        }
    }

    // Check if all lands finished
    if (wins.every((w) => w !== null)) {
        const xCount = wins.filter((w) => w === "X").length;
        const oCount = wins.filter((w) => w === "O").length;
        if (xCount > oCount) return "X";
        if (oCount > xCount) return "O";
        return "DRAW";
    }

    return false;
}

function endGame(winner) {

    sounds.time.pause();
    sounds.time.currentTime = 0;
    sounds.time.loop = false;

     // 🔊 RESULT SOUND FIX
// 🔊 RESULT SOUND FIX (WIN / LOSE / DRAW)
if (winner === "DRAW") {
    playSound(sounds.draw);
} else if (roomId) {
    // ONLINE MULTIPLAYER
    playSound(winner === playerSymbol ? sounds.win : sounds.lose);
} else if (state.opponent === "ai") {
    // AI MODE
    playSound(winner === state.playerSymbol ? sounds.win : sounds.lose);
} else {
    // LOCAL PVP
    playSound(sounds.win);
}

    state.gameActive = false;
    clearInterval(state.timerInterval);

    if (winner === "X") state.scores.X++;
    else if (winner === "O") state.scores.O++;
    else state.scores.draw++;

    updateScoreboard();

    const message =
        winner === "DRAW"
            ? "STALEMATE DETECTED"
            : `FACTION ${winner} DOMINANCE`;
    log("event", `GAME OVER: ${message}`);

    // Check Series
    const seriesWinner = isSeriesOver();
    if (seriesWinner) {
        showModal(
            "SERIES COMPLETE",
            seriesWinner === "DRAW"
                ? "SERIES DRAW"
                : `VICTORY: PLAYER ${seriesWinner}`,
        );
        state.round = 0; // Reset for next
    } else {
    // ===== ONLINE / LOCAL / AI RESULT FIX =====
    let modalTitleText = "VICTORY";

    if (winner === "DRAW") {
      modalTitleText = "DRAW";
    } else if (roomId) {
      // ONLINE MULTIPLAYER
      modalTitleText = winner !== playerSymbol ? "LOSE" : "VICTORY";
    } else if (state.opponent === "ai") {
      // 🔥 AI MODE
      modalTitleText = winner !== state.playerSymbol ? "LOSE" : "VICTORY";
    } else {
      // LOCAL PVP
      modalTitleText = "VICTORY";
    }

    showModal(modalTitleText, message);
}
}

// --- AI ENGINE ---
function processAiTurn() {
    // 🔥 BLOCK AI ONLY IF ONLINE MULTIPLAYER
if (state.opponent === "online") return;
    if (!state.gameActive) return;

    const aiPlayer = state.currentPlayer; // 'O' usually
    const humanPlayer = state.playerSymbol;

    let move = null;

    // Difficulty Router
    if (state.aiDifficulty === "easy") {
        move = getRandomMove();
    } else if (state.aiDifficulty === "medium") {
        move = getTacticalMove(aiPlayer, humanPlayer, 0.5); // 50% chance of optimal
    } else if (state.aiDifficulty === "hard") {
        move = getTacticalMove(aiPlayer, humanPlayer, 0.9); // 90% chance
    } else if (state.aiDifficulty === "impossible") {
        move = getBestMove(aiPlayer, humanPlayer); // Minimax
    }

      if (move) {
    playSound(sounds.move);   // 🔊 AI MOVE SOUND
    makeMove(move.landIndex, move.cellIndex, aiPlayer);
}

    }


function getAvailableMoves() {
    const moves = [];
    state.boards.forEach((board, lIdx) => {
        if (state.boardWinners[lIdx]) return;
        board.forEach((cell, cIdx) => {
            if (!cell) moves.push({ landIndex: lIdx, cellIndex: cIdx });
        });
    });
    return moves;
}

function getRandomMove() {
    const moves = getAvailableMoves();
    if (moves.length === 0) return null;
    return moves[Math.floor(Math.random() * moves.length)];
}

// Medium/Hard Heuristic Logic
function getTacticalMove(aiPlayer, enemyPlayer, skillFactor) {
    if (Math.random() > skillFactor) return getRandomMove();

    const moves = getAvailableMoves();

    // 1. Check for immediate Land Win
    for (let m of moves) {
        if (simLandWin(m.landIndex, m.cellIndex, aiPlayer)) return m;
    }

    // 2. Block enemy Land Win
    for (let m of moves) {
        if (simLandWin(m.landIndex, m.cellIndex, enemyPlayer)) return m;
    }

    // 3. Pick center if available
    const centers = moves.filter((m) => m.cellIndex === 4);
    if (centers.length > 0)
        return centers[Math.floor(Math.random() * centers.length)];

    // 4. Random fallback
    return getRandomMove();
}

function simLandWin(landIndex, cellIndex, player) {
    // Clone board
    const board = [...state.boards[landIndex]];
    board[cellIndex] = player;

    // Check win (reuse check logic but simplified)
    const winPatterns = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
    ];
    return winPatterns.some((p) => p.every((idx) => board[idx] === player));
}

// Impossible Minimax (Depth limited for performance in 9-board game)
function getBestMove(aiPlayer, humanPlayer) {
    // Full minimax on 81 squares is too slow.
    // Strategy: Evaluate each LAND independently to get a score for that land.
    // Then choose the move that maximizes the weighted score.

    const moves = getAvailableMoves();
    let bestScore = -Infinity;
    let bestMoves = [];

    for (let m of moves) {
        // Heuristic Score for this move
        let score = evaluateMove(m, aiPlayer, humanPlayer);

        if (score > bestScore) {
            bestScore = score;
            bestMoves = [m];
        } else if (score === bestScore) {
            bestMoves.push(m);
        }
    }

    return bestMoves.length > 0
        ? bestMoves[Math.floor(Math.random() * bestMoves.length)]
        : null;
}

function evaluateMove(move, aiPlayer, humanPlayer) {
    let score = 0;

    // 1. Value of winning the local board
    if (simLandWin(move.landIndex, move.cellIndex, aiPlayer)) {
        score += 100;
        // 1.1 Meta-win bonus (3 lands in a row)
        if (simGlobalWin(move.landIndex, aiPlayer)) {
            score += 1000;
        }
    }

    // 2. Value of blocking enemy local win
    if (simLandWin(move.landIndex, move.cellIndex, humanPlayer)) {
        score += 80;
        if (simGlobalWin(move.landIndex, humanPlayer)) {
            score += 500;
        }
    }

    // 3. Positional value on local board (Center > Corner > Edge)
    const posScores = [3, 2, 3, 2, 4, 2, 3, 2, 3]; // Corner, Edge, Center weights
    score += posScores[move.cellIndex];

    // 4. Strategic land value (Center land is better)
    const landScores = [3, 2, 3, 2, 4, 2, 3, 2, 3];
    if (state.mode === "territory") {
        score += landScores[move.landIndex];
    }

    return score;
}

function simGlobalWin(newLandIndex, player) {
    // Pretend we won this land
    const currentWins = [...state.boardWinners];
    currentWins[newLandIndex] = player;

    const winPatterns = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
    ];

    return winPatterns.some((p) =>
        p.every((idx) => currentWins[idx] === player),
    );
}

// --- TIME MODE LOGIC ---
function startTimer() {
    clearInterval(state.timerInterval);
    state.timer = 10;
    updateTimerUI();

    state.timerInterval = setInterval(() => {
        state.timer -= 0.1;
        updateTimerUI();

        if (state.timer <= 0) {
            triggerTimeEvent();
            resetTimer();
        }
    }, 100);
}

function resetTimer() {
    clearInterval(state.timerInterval);

    // 🔊 TIME ANOMALY SOUND RESTART ON EVERY TURN
    if (state.timeMode && state.gameActive) {
        sounds.time.pause();
        sounds.time.currentTime = 0;
        sounds.time.loop = true;
        sounds.time.play().catch(() => {});
        startTimer();
    }
}


function updateTimerUI() {
    const pct = (state.timer / 10) * 100;
    UI.timerFill.style.width = `${pct}%`;
    UI.timerSeconds.textContent = Math.ceil(state.timer);

    if (state.timer < 3) UI.timerFill.style.background = "var(--neon-pink)";
    else UI.timerFill.style.background = "var(--neon-yellow)";
}

function triggerTimeEvent() {
    playSound(sounds.time);   // ⏳ TIME ANOMALY SOUND
    log("event", "TIME ANOMALY DETECTED: POLARITY REVERSAL");

    // Flip all X and O on boards
    state.boards.forEach((board, lIdx) => {
        // Only flip active cells in active lands
        if (state.boardWinners[lIdx]) return;

        board.forEach((cell, cIdx) => {
            if (cell === "X") state.boards[lIdx][cIdx] = "O";
            else if (cell === "O") state.boards[lIdx][cIdx] = "X";
        });
    });

    // Animate flip
    document.querySelectorAll(".cell.taken").forEach((el) => {
        if (!el.classList.contains("winner-cell")) {
            // Don't flip completed lands visually if simplified
            el.classList.add("flipped");
            setTimeout(() => {
                const currentText = el.textContent;
                el.textContent = currentText === "X" ? "O" : "X";
                el.className = `cell taken ${el.textContent} flipped`;
            }, 250);
            setTimeout(() => el.classList.remove("flipped"), 500);
        }
    });

    // Swap current player to keep flow chaotic? Or just swap pieces?
    // "All X ↔ O symbols flip".
    // Does ownership change? Yes.
    // Does current player change? The requirements say "Game continues".
    // Usually if symbols flip, X becomes O.
    // If I was X, and I just played, now my pieces are O.

    // Re-evaluate board wins after flip?
    // "When timer ends: All X ↔ O symbols flip. Game continues."
    // Yes, we should check for wins again.

    state.boards.forEach((board, lIdx) => {
        if (!state.boardWinners[lIdx]) {
            // Check if flip caused a win
            // Simplified: We assume checkLandWin handles it on next move or we check now.
            // Let's check all open lands
            if (checkPattern(board, "X")) checkLandWin(lIdx, "X");
            else if (checkPattern(board, "O")) checkLandWin(lIdx, "O");
        }
    });

    if (checkGlobalWin()) endGame(checkGlobalWin());
}

function checkPattern(board, player) {
    const winPatterns = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
    ];
    return winPatterns.some((p) => p.every((idx) => board[idx] === player));
}

// --- UTILS ---
function updateStatus() {
    const pName =
        state.currentPlayer === state.playerSymbol
            ? UI.playerNameInput.value
            : "CPU";
    const displayPlayer =
        state.opponent === "ai" && state.currentPlayer !== state.playerSymbol
            ? "CPU"
            : UI.playerNameInput.value;

    UI.statusMessage.textContent = `AWAITING INPUT: ${displayPlayer} (${state.currentPlayer})`;

    UI.gameContainer.classList.remove("turn-X", "turn-O");
    UI.gameContainer.classList.add(`turn-${state.currentPlayer}`);
}

function updateScoreboard() {
    UI.scoreX.textContent = state.scores.X;
    UI.scoreO.textContent = state.scores.O;
    UI.scoreDraw.textContent = state.scores.draw;
    UI.currentRound.textContent = state.round;

    if (state.series === "free") UI.seriesTarget.textContent = "FREE PLAY";
    else UI.seriesTarget.textContent = `BEST OF ${state.series}`;
}

function log(type, msg) {
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    entry.textContent = `> ${msg}`;
    UI.logContainer.insertBefore(entry, UI.logContainer.firstChild);
}

function showModal(title, msg) {
    UI.modalTitle.textContent = title;
    UI.modalMessage.textContent = msg;
    UI.modal.classList.remove("hidden");
}

function applyRoomSettings(settings) {

    if (!roomId) return;

    state.mode = settings.mode;
    state.timeMode = settings.timeMode;
    state.series = settings.series;

    UI.modeSelect.value = settings.mode;
    UI.seriesSelect.value = settings.series;
    UI.timeModeCheck.checked = settings.timeMode;

    // 🔥 SERIES UI FIX (THIS WAS MISSING)
    resetSeries();        // scores + round reset
    updateScoreboard();   // BEST OF 3 / 10 text update

    if (state.timeMode) {
        UI.timeOverlay.classList.remove("hidden");
    } else {
        UI.timeOverlay.classList.add("hidden");
    }

    startNewGame();
}




// Boot

init();
