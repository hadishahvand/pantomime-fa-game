import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import express from "express";
import { Server } from "socket.io";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORDS_PATH = path.join(__dirname, "data", "words-game.json");

/** منبع لیست اولیه: https://github.com/mvalipour/word-list-fa (فیلتر شده برای بازی) */
let words = [];
try {
  words = JSON.parse(fs.readFileSync(WORDS_PATH, "utf8"));
} catch (e) {
  console.warn("words-game.json missing, using fallback");
  words = ["گربه", "سگ", "خانه", "ماشین", "کتاب", "درخت", "ماهی", "پرواز", "دویدن", "خواب"];
}

function normalizeFa(s) {
  return String(s || "")
    .replace(/\u200c/g, "")
    .replace(/\s+/g, " ")
    .replace(/\u064a/g, "\u06cc")
    .replace(/\u0643/g, "\u06a9")
    .trim()
    .normalize("NFC");
}

function randomWord() {
  return words[Math.floor(Math.random() * words.length)] || "کلمه";
}

function randomRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

const rooms = new Map();

function getRoom(code) {
  return rooms.get(code);
}

function createRoom(hostSocketId) {
  let code;
  do {
    code = randomRoomCode();
  } while (rooms.has(code));
  const room = {
    code,
    hostId: hostSocketId,
    players: [],
    started: false,
    round: null,
    scores: {},
    lastActorId: null,
  };
  rooms.set(code, room);
  return room;
}

function addPlayer(room, socketId, name) {
  const n = normalizeFa(name).slice(0, 24) || "بازیکن";
  if (!room.players.find((p) => p.id === socketId)) {
    room.players.push({ id: socketId, name: n });
    if (room.scores[socketId] == null) room.scores[socketId] = 0;
  } else {
    const p = room.players.find((x) => x.id === socketId);
    if (p) p.name = n;
  }
}

function removePlayer(room, socketId) {
  room.players = room.players.filter((p) => p.id !== socketId);
  if (room.hostId === socketId && room.players.length) {
    room.hostId = room.players[0].id;
  }
}

function enrichStateForSocket(room, socketId, base) {
  const out = JSON.parse(JSON.stringify(base));
  if (room.round && socketId === room.round.actorId) {
    if (out.round) out.round.word = room.round.word;
  }
  return out;
}

function emitToSocket(io, room, socketId) {
  const payload = {
    code: room.code,
    hostId: room.hostId,
    players: room.players.map((p) => ({ id: p.id, name: p.name, score: room.scores[p.id] || 0 })),
    started: room.started,
    round: room.round
      ? {
          actorId: room.round.actorId,
          endsAt: room.round.endsAt,
          word: null,
        }
      : null,
  };
  io.to(socketId).emit("room_state", enrichStateForSocket(room, socketId, payload));
}

function startRound(room) {
  if (room.players.length < 2) return false;
  let idx = 0;
  if (room.lastActorId) {
    const i = room.players.findIndex((p) => p.id === room.lastActorId);
    if (i >= 0) idx = (i + 1) % room.players.length;
  }
  const actor = room.players[idx];
  room.lastActorId = actor.id;
  room.round = {
    actorId: actor.id,
    word: randomWord(),
    endsAt: Date.now() + 90_000,
    guessedBy: null,
  };
  room.started = true;
  return true;
}

/** اگر کاربر اتاق جدید بسازد یا به اتاق دیگر برود، از اتاق قبلی جدا شود */
function detachSocketFromRooms(io, socket) {
  const sid = socket.id;
  for (const [code, room] of rooms) {
    if (!room.players.some((p) => p.id === sid)) continue;
    socket.leave(code);
    if (room.round?.actorId === sid) {
      io.to(code).emit("round_result", { skipped: true, word: room.round.word, reason: "بازیگر اتاق را ترک کرد" });
      room.round = null;
    }
    removePlayer(room, sid);
    if (!room.players.length) {
      rooms.delete(code);
    } else {
      for (const p of room.players) emitToSocket(io, room, p.id);
    }
  }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true },
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, words: words.length });
});

io.on("connection", (socket) => {
  socket.on("create_room", (name, cb) => {
    detachSocketFromRooms(io, socket);
    const room = createRoom(socket.id);
    addPlayer(room, socket.id, name);
    socket.join(room.code);
    if (typeof cb === "function") cb({ ok: true, code: room.code });
    emitToSocket(io, room, socket.id);
  });

  socket.on("join_room", ({ code, name }, cb) => {
    const c = String(code || "").toUpperCase().trim();
    const room = getRoom(c);
    if (!room) {
      if (typeof cb === "function") cb({ ok: false, error: "اتاق پیدا نشد" });
      return;
    }
    detachSocketFromRooms(io, socket);
    socket.join(c);
    addPlayer(room, socket.id, name);
    if (typeof cb === "function") cb({ ok: true, code: room.code });
    for (const p of room.players) emitToSocket(io, room, p.id);
  });

  socket.on("start_round", () => {
    for (const [, room] of rooms) {
      if (!room.players.some((p) => p.id === socket.id)) continue;
      if (room.hostId !== socket.id) return;
      if (room.round) return;
      if (startRound(room)) {
        for (const p of room.players) emitToSocket(io, room, p.id);
      }
    }
  });

  socket.on("guess", (text) => {
    const g = normalizeFa(text);
    if (!g) return;
    for (const [, room] of rooms) {
      if (!room.round || room.round.guessedBy) continue;
      if (!room.players.some((p) => p.id === socket.id)) continue;
      if (socket.id === room.round.actorId) continue;
      const w = normalizeFa(room.round.word);
      if (g === w) {
        const word = room.round.word;
        room.round.guessedBy = socket.id;
        room.scores[socket.id] = (room.scores[socket.id] || 0) + 1;
        room.round = null;
        io.to(room.code).emit("round_result", { winnerId: socket.id, word });
        for (const p of room.players) emitToSocket(io, room, p.id);
      }
    }
  });

  socket.on("skip_round", () => {
    for (const [, room] of rooms) {
      if (!room.round) continue;
      if (room.hostId !== socket.id && socket.id !== room.round.actorId) continue;
      io.to(room.code).emit("round_result", { skipped: true, word: room.round.word });
      room.round = null;
      for (const p of room.players) emitToSocket(io, room, p.id);
    }
  });

  socket.on("disconnect", () => {
    for (const [code, room] of rooms) {
      if (!room.players.some((p) => p.id === socket.id)) continue;
      removePlayer(room, socket.id);
      if (!room.players.length) {
        rooms.delete(code);
        return;
      }
      if (!room.round) {
        for (const p of room.players) emitToSocket(io, room, p.id);
        return;
      }
      if (room.round.actorId === socket.id) {
        io.to(room.code).emit("round_result", { skipped: true, word: room.round.word, reason: "بازیگر خارج شد" });
        room.round = null;
      }
      for (const p of room.players) emitToSocket(io, room, p.id);
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [, room] of rooms) {
    if (!room.round || room.round.guessedBy) continue;
    if (now < room.round.endsAt) continue;
    const word = room.round.word;
    room.round = null;
    io.to(room.code).emit("round_result", { timeout: true, word });
    for (const p of room.players) emitToSocket(io, room, p.id);
  }
}, 1000);

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => {
  console.log(`pantomime-fa http://localhost:${PORT}`);
});
