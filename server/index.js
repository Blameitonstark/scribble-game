const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const path = require("path");
app.use(express.static(path.join(__dirname, "..", "client")));


const words = JSON.parse(fs.readFileSync("words.json", "utf8"));

const rooms = {};

function getWord(difficulty) {
  const list = words[difficulty] || words.medium;
  return list[Math.floor(Math.random() * list.length)];
}

function maskWord(word) {
  if (word.length <= 2) return word; // no point masking
  const chars = word.split("");
  return chars.map((ch, i) => (i === 0 || i === chars.length - 1 ? ch : "_")).join(" ");
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({ username, roomCode }) => {
    rooms[roomCode] = {
      host: socket.id,
      players: [{ id: socket.id, name: username, score: 0 }],
      round: 0,
      maxRounds: 5,
      duration: 30,
      difficulty: "medium",
      inProgress: false,
    };
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.emit("roomCreated", roomCode);
  });

  socket.on("joinRoom", ({ username, roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.inProgress) return;

    room.players.push({ id: socket.id, name: username, score: 0 });
    socket.join(roomCode);
    socket.roomCode = roomCode;
  });

  socket.on("startGame", ({ roomCode, rounds, duration, difficulty }) => {
    const room = rooms[roomCode];
    if (!room) return;

    room.maxRounds = rounds;
    room.duration = duration;
    room.difficulty = difficulty;
    room.round = 0;
    room.inProgress = true;
    startNextRound(roomCode);
  });

  socket.on("draw", (data) => {
    const roomCode = socket.roomCode;
    socket.to(roomCode).emit("draw", data);
  });

  socket.on("clear", (roomCode) => {
    socket.to(roomCode).emit("clear");
  });

  socket.on("guess", ({ guess, roomCode }) => {
    const room = rooms[roomCode];
    if (!room || !room.currentWord) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || room.guessedIds.includes(player.id)) return;

    if (guess.trim().toLowerCase() === room.currentWord.toLowerCase()) {
      player.score += 10;
      room.guessedIds.push(player.id);
      io.to(roomCode).emit("message", `${player.name} guessed correctly!`);
      updateScores(roomCode);
    } else {
      io.to(roomCode).emit("message", `${player.name}: ${guess}`);
    }
  });
});

function updateScores(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  room.players.sort((a, b) => b.score - a.score);
  io.to(roomCode).emit("scoreboard", room.players);
}

function startNextRound(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  if (room.round >= room.maxRounds) {
    io.to(roomCode).emit("gameOver", room.players);
    return;
  }

  room.round++;
  room.drawerIndex = room.drawerIndex === undefined ? 0 : (room.drawerIndex + 1) % room.players.length;
  const drawer = room.players[room.drawerIndex];
  const word = getWord(room.difficulty);
  const masked = maskWord(word);

  room.currentWord = word;
  room.guessedIds = [];

  room.players.forEach(p => {
    if (p.id === drawer.id) {
      io.to(p.id).emit("roundData", {
        drawer: drawer.name,
        round: room.round,
        word: word, // full word to drawer
        isDrawer: true
      });
    } else {
      io.to(p.id).emit("roundData", {
        drawer: drawer.name,
        round: room.round,
        word: masked, // masked to others
        isDrawer: false
      });
    }
  });

  setTimeout(() => {
    startNextRound(roomCode);
  }, room.duration * 1000);
}
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});

server.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});
