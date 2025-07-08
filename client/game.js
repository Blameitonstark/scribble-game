const socket = io();
socket.on("roomCreated", (code) => {
  document.getElementById("joinScreen").classList.add("hidden");
  document.getElementById("hostLobby").classList.remove("hidden");
  
  // 💡 This is what displays the room code
  const roomDisplay = document.getElementById("roomCodeDisplay");
  if (roomDisplay) {
    roomDisplay.textContent = `Room Code: ${code}`;
  }
});

const usernameInput = document.getElementById("usernameInput");
const roomCodeInput = document.getElementById("roomCodeInput");

const joinScreen = document.getElementById("joinScreen");
const hostLobby = document.getElementById("hostLobby");
const gameScreen = document.getElementById("gameScreen");
const gameOverScreen = document.getElementById("gameOverScreen");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const colorPicker = document.getElementById("colorPicker");
const brushSize = document.getElementById("brushSize");
const clearCanvas = document.getElementById("clearCanvas");

const guessInput = document.getElementById("guessInput");
const sendGuess = document.getElementById("sendGuess");
const messages = document.getElementById("messages");

const scoreboard = document.getElementById("scoreboard");
const finalScoreboard = document.getElementById("finalScoreboard");

const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const startGameBtn = document.getElementById("startGameBtn");

const roundsInput = document.getElementById("roundsInput");
const timeInput = document.getElementById("timeInput");
const difficultyInput = document.getElementById("difficultyInput");

let drawing = false;
let isDrawer = false;
let roomCode = "";

createBtn.onclick = () => {
  const username = usernameInput.value.trim();
  if (!username) return alert("Enter your name.");
  roomCode = Math.random().toString(36).substr(2, 5).toUpperCase();
  socket.emit("createRoom", { username, roomCode });
  joinScreen.classList.add("hidden");
  hostLobby.classList.remove("hidden");
};

joinBtn.onclick = () => {
  const username = usernameInput.value.trim();
  roomCode = roomCodeInput.value.trim().toUpperCase();
  if (!username || !roomCode) return alert("Fill all fields.");
  socket.emit("joinRoom", { username, roomCode });
  joinScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
};

startGameBtn.onclick = () => {
  const rounds = parseInt(roundsInput.value);
  const duration = parseInt(timeInput.value);
  const difficulty = difficultyInput.value;
  socket.emit("startGame", { roomCode, rounds, duration, difficulty });
  hostLobby.classList.add("hidden");
  gameScreen.classList.remove("hidden");
};

// Canvas drawing
canvas.addEventListener("mousedown", (e) => {
  if (!isDrawer) return;
  drawing = true;
  draw(e.offsetX, e.offsetY, false);
});
canvas.addEventListener("mousemove", (e) => {
  if (!drawing || !isDrawer) return;
  draw(e.offsetX, e.offsetY, true);
});
canvas.addEventListener("mouseup", () => (drawing = false));
canvas.addEventListener("mouseout", () => (drawing = false));

function draw(x, y, drag) {
  const color = colorPicker.value;
  const size = parseInt(brushSize.value);
  socket.emit("draw", { x, y, drag, color, size, roomCode });
  renderDraw(x, y, drag, color, size);
}

function renderDraw(x, y, drag, color, size) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineJoin = "round";

  if (drag && lastPos) {
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.stroke();
  }

  lastPos = { x, y };
}

clearCanvas.onclick = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.emit("clear", roomCode);
};

socket.on("clear", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Word display + round info
socket.on("roundData", ({ drawer, round, word, isDrawer: drawerFlag }) => {
  isDrawer = drawerFlag;
  document.getElementById("currentDrawer").textContent = `Drawer: ${drawer} (Round ${round})`;
  document.getElementById("wordDisplay").textContent = drawerFlag
    ? `🖌️ Your word: ${word}`
    : `Guess the word: ${word}`;
  guessInput.disabled = drawerFlag;
  sendGuess.disabled = drawerFlag;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  lastPos = null;
});

// Guessing
sendGuess.onclick = () => {
  const guess = guessInput.value.trim();
  if (!guess) return;
  socket.emit("guess", { guess, roomCode });
  guessInput.value = "";
};

socket.on("message", (msg) => {
  const p = document.createElement("p");
  p.textContent = msg;
  messages.appendChild(p);
  messages.scrollTop = messages.scrollHeight;
});

// Real-time scoreboard
socket.on("scoreboard", (players) => {
  scoreboard.innerHTML = "";
  players.forEach((p, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}. ${p.name}: ${p.score}`;
    scoreboard.appendChild(li);
  });
});

// Final scoreboard
socket.on("gameOver", (players) => {
  gameScreen.classList.add("hidden");
  gameOverScreen.classList.remove("hidden");
  finalScoreboard.innerHTML = "";
  players.forEach((p, i) => {
    const li = document.createElement("li");
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🏅";
    li.textContent = `${medal} ${p.name}: ${p.score}`;
    finalScoreboard.appendChild(li);
  });
});

let lastPos = null;
socket.on("draw", (data) => {
  renderDraw(data.x, data.y, data.drag, data.color, data.size);
});
