import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import express from "express";
import { Server } from "socket.io";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORDS_GAME = path.join(__dirname, "data", "words-game.json");
const WORDS_TOPICS = path.join(__dirname, "data", "words-topics.json");

const ROUND_MS = 90_000;

function normalizeFa(s) {
  return String(s || "")
    .replace(/\u200c/g, "")
    .replace(/\s+/g, " ")
    .replace(/\u064a/g, "\u06cc")
    .replace(/\u0643/g, "\u06a9")
    .trim()
    .normalize("NFC");
}

function bucketByLength(w) {
  const L = [...normalizeFa(w)].length;
  if (L <= 4) return "easy";
  if (L <= 7) return "medium";
  return "hard";
}

function uniq(arr) {
  return [...new Set(arr.map((x) => normalizeFa(x)).filter(Boolean))];
}

function loadWordPools() {
  let flat = [];
  try {
    flat = JSON.parse(fs.readFileSync(WORDS_GAME, "utf8"));
  } catch {
    flat = ["گربه", "سگ", "خانه", "ماشین", "کتاب"];
  }
  flat = uniq(flat);

  const mixed = { easy: [], medium: [], hard: [], all: [] };
  for (const w of flat) {
    const b = bucketByLength(w);
    mixed[b].push(w);
    mixed.all.push(w);
  }

  let topicsMeta = [];
  const byTopic = {};
  try {
    const raw = JSON.parse(fs.readFileSync(WORDS_TOPICS, "utf8"));
    topicsMeta = (raw.topics || []).map((t) => ({ id: t.id, label: t.label }));
    for (const t of raw.topics || []) {
      const words = uniq(t.words || []);
      const pools = { easy: [], medium: [], hard: [], all: [] };
      for (const w of words) {
        pools[bucketByLength(w)].push(w);
        pools.all.push(w);
      }
      byTopic[t.id] = pools;
    }
  } catch {
    topicsMeta = [];
  }

  return { mixed, byTopic, topicsMeta, flat };
}

const POOLS = loadWordPools();

function pickRandom(arr, avoid) {
  const a = arr.filter((w) => w && w !== avoid);
  const src = a.length ? a : arr.filter(Boolean);
  if (!src.length) return "کلمه";
  return src[Math.floor(Math.random() * src.length)];
}

function selectPool(room) {
  const { wordMode, topicId, difficulty } = room.setup;
  const d = difficulty === "mixed" ? "all" : difficulty;
  let pool;
  if (wordMode === "topic" && topicId && POOLS.byTopic[topicId]) {
    pool = POOLS.byTopic[topicId][d] || POOLS.byTopic[topicId].all;
    if (pool?.length) return pool;
    return POOLS.byTopic[topicId].all?.length ? POOLS.byTopic[topicId].all : POOLS.mixed.all;
  }
  pool = POOLS.mixed[d] || POOLS.mixed.all;
  return pool?.length ? pool : POOLS.mixed.all;
}

function drawWord(room) {
  const pool = selectPool(room);
  return pickRandom(pool, room.lastWord);
}

const rooms = new Map();

function randomRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
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
    phase: "setup",
    setup: {
      teamNames: ["تیم الف", "تیم ب"],
      totalRounds: 10,
      wordMode: "random",
      topicId: POOLS.topicsMeta[0]?.id || "animals",
      difficulty: "medium",
    },
    teamScores: [0, 0],
    handsPlayed: 0,
    teamActorSlot: [0, 0],
    round: null,
    lastWord: null,
  };
  rooms.set(code, room);
  return room;
}

function addPlayer(room, socketId, name) {
  const n = normalizeFa(name).slice(0, 24) || "بازیکن";
  const existing = room.players.find((p) => p.id === socketId);
  if (!existing) {
    room.players.push({ id: socketId, name: n, teamIndex: null });
  } else {
    existing.name = n;
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

function buildPublicState(room) {
  const guessingTeam = room.round ? 1 - room.round.actingTeamIndex : null;
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    setup: { ...room.setup },
    topicsMeta: POOLS.topicsMeta,
    teamScores: [...room.teamScores],
    handsPlayed: room.handsPlayed,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      teamIndex: p.teamIndex,
    })),
    round: room.round
      ? {
          actorId: room.round.actorId,
          actingTeamIndex: room.round.actingTeamIndex,
          guessingTeamIndex: guessingTeam,
          endsAt: room.round.endsAt,
          wordSwapsUsed: room.round.wordSwapsUsed,
          wordSwapMax: room.round.wordSwapMax,
          word: null,
        }
      : null,
  };
}

function emitToSocket(io, room, socketId) {
  io.to(socketId).emit("room_state", enrichStateForSocket(room, socketId, buildPublicState(room)));
}

function broadcastRoom(io, room) {
  for (const p of room.players) emitToSocket(io, room, p.id);
}

function getRoomBySocket(socketId) {
  for (const [, room] of rooms) {
    if (room.players.some((p) => p.id === socketId)) return room;
  }
  return null;
}

function startRound(room) {
  if (room.phase !== "playing") return false;
  if (room.round) return false;
  if (room.handsPlayed >= room.setup.totalRounds) {
    room.phase = "finished";
    return false;
  }

  const actingTeam = room.handsPlayed % 2;
  const members = room.players.filter((p) => p.teamIndex === actingTeam).sort((a, b) => a.id.localeCompare(b.id));
  if (members.length === 0) return false;

  const slot = room.teamActorSlot[actingTeam] % members.length;
  const actor = members[slot];
  room.teamActorSlot[actingTeam]++;

  const word = drawWord(room);
  room.lastWord = word;
  room.round = {
    actorId: actor.id,
    actingTeamIndex: actingTeam,
    guessingTeamIndex: 1 - actingTeam,
    word,
    endsAt: Date.now() + ROUND_MS,
    guessedBy: null,
    wordSwapsUsed: 0,
    wordSwapMax: 1,
  };
  return true;
}

function endRound(room, io, extraEmit) {
  room.round = null;
  room.handsPlayed++;
  if (room.handsPlayed >= room.setup.totalRounds) {
    room.phase = "finished";
  }
  if (extraEmit) io.to(room.code).emit("round_result", extraEmit);
  broadcastRoom(io, room);
}

function detachSocketFromRooms(io, socket) {
  const sid = socket.id;
  for (const [code, room] of rooms) {
    if (!room.players.some((p) => p.id === sid)) continue;
    socket.leave(code);
    if (room.round?.actorId === sid) {
      io.to(code).emit("round_result", { skipped: true, word: room.round.word, reason: "بازیگر اتاق را ترک کرد" });
      room.round = null;
      room.handsPlayed++;
      if (room.handsPlayed >= room.setup.totalRounds) room.phase = "finished";
    }
    removePlayer(room, sid);
    if (!room.players.length) {
      rooms.delete(code);
    } else {
      broadcastRoom(io, room);
    }
  }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, words: POOLS.flat.length, topics: POOLS.topicsMeta.length });
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
    const room = rooms.get(c);
    if (!room) {
      if (typeof cb === "function") cb({ ok: false, error: "اتاق پیدا نشد" });
      return;
    }
    detachSocketFromRooms(io, socket);
    socket.join(c);
    addPlayer(room, socket.id, name);
    if (typeof cb === "function") cb({ ok: true, code: room.code });
    broadcastRoom(io, room);
  });

  socket.on("pick_team", ({ teamIndex }, cb) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.phase !== "setup") {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    const t = teamIndex === 1 ? 1 : 0;
    const p = room.players.find((x) => x.id === socket.id);
    if (p) p.teamIndex = t;
    broadcastRoom(io, room);
    if (typeof cb === "function") cb({ ok: true });
  });

  socket.on("update_setup", (payload, cb) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id || room.phase !== "setup") {
      if (typeof cb === "function") cb({ ok: false, error: "مجاز نیست" });
      return;
    }
    const s = room.setup;
    if (Array.isArray(payload.teamNames) && payload.teamNames.length >= 2) {
      s.teamNames[0] = normalizeFa(payload.teamNames[0]).slice(0, 32) || s.teamNames[0];
      s.teamNames[1] = normalizeFa(payload.teamNames[1]).slice(0, 32) || s.teamNames[1];
    }
    const tr = Number(payload.totalRounds);
    if (Number.isFinite(tr)) s.totalRounds = Math.min(50, Math.max(1, Math.floor(tr)));
    if (payload.wordMode === "topic" || payload.wordMode === "random") s.wordMode = payload.wordMode;
    if (typeof payload.topicId === "string" && POOLS.byTopic[payload.topicId]) s.topicId = payload.topicId;
    if (["easy", "medium", "hard", "mixed"].includes(payload.difficulty)) s.difficulty = payload.difficulty;
    broadcastRoom(io, room);
    if (typeof cb === "function") cb({ ok: true });
  });

  socket.on("start_game", (cb) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) {
      if (typeof cb === "function") cb({ ok: false, error: "فقط میزبان" });
      return;
    }
    if (room.phase !== "setup") {
      if (typeof cb === "function") cb({ ok: false, error: "بازی شروع شده" });
      return;
    }
    const t0 = room.players.filter((p) => p.teamIndex === 0).length;
    const t1 = room.players.filter((p) => p.teamIndex === 1).length;
    if (room.players.some((p) => p.teamIndex !== 0 && p.teamIndex !== 1)) {
      if (typeof cb === "function") cb({ ok: false, error: "همه باید تیم انتخاب کنند" });
      return;
    }
    if (t0 < 1 || t1 < 1) {
      if (typeof cb === "function") cb({ ok: false, error: "هر تیم حداقل یک نفر لازم دارد" });
      return;
    }
    room.teamScores = [0, 0];
    room.handsPlayed = 0;
    room.teamActorSlot = [0, 0];
    room.round = null;
    room.lastWord = null;
    room.phase = "playing";
    if (!startRound(room)) {
      room.phase = "setup";
      if (typeof cb === "function") cb({ ok: false, error: "شروع دست ممکن نشد" });
      broadcastRoom(io, room);
      return;
    }
    broadcastRoom(io, room);
    if (typeof cb === "function") cb({ ok: true });
  });

  socket.on("start_round", () => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return;
    if (room.phase !== "playing") return;
    if (room.round) return;
    if (startRound(room)) broadcastRoom(io, room);
  });

  socket.on("guess", (text) => {
    const g = normalizeFa(text);
    if (!g) return;
    const room = getRoomBySocket(socket.id);
    if (!room?.round || room.round.guessedBy) return;
    const p = room.players.find((x) => x.id === socket.id);
    if (!p || p.teamIndex !== room.round.guessingTeamIndex) return;
    if (socket.id === room.round.actorId) return;
    const w = normalizeFa(room.round.word);
    if (g !== w) return;
    const word = room.round.word;
    const gt = room.round.guessingTeamIndex;
    room.teamScores[gt] = (room.teamScores[gt] || 0) + 1;
    room.round = null;
    room.handsPlayed++;
    if (room.handsPlayed >= room.setup.totalRounds) room.phase = "finished";
    io.to(room.code).emit("round_result", { winnerId: socket.id, word, teamIndex: gt });
    broadcastRoom(io, room);
  });

  socket.on("swap_word", (cb) => {
    const room = getRoomBySocket(socket.id);
    if (!room?.round) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    if (room.hostId !== socket.id && socket.id !== room.round.actorId) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    if (room.round.wordSwapsUsed >= room.round.wordSwapMax) {
      if (typeof cb === "function") cb({ ok: false, error: "تعویض کلمه فقط یک بار" });
      return;
    }
    const nw = drawWord(room);
    room.lastWord = nw;
    room.round.word = nw;
    room.round.wordSwapsUsed++;
    broadcastRoom(io, room);
    if (typeof cb === "function") cb({ ok: true });
  });

  socket.on("skip_round", () => {
    const room = getRoomBySocket(socket.id);
    if (!room?.round) return;
    if (room.hostId !== socket.id && socket.id !== room.round.actorId) return;
    const word = room.round.word;
    room.round = null;
    room.handsPlayed++;
    if (room.handsPlayed >= room.setup.totalRounds) room.phase = "finished";
    io.to(room.code).emit("round_result", { skipped: true, word });
    broadcastRoom(io, room);
  });

  socket.on("reset_lobby", (cb) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    room.phase = "setup";
    room.round = null;
    room.teamScores = [0, 0];
    room.handsPlayed = 0;
    room.teamActorSlot = [0, 0];
    room.lastWord = null;
    for (const p of room.players) p.teamIndex = null;
    broadcastRoom(io, room);
    if (typeof cb === "function") cb({ ok: true });
  });

  socket.on("disconnect", () => {
    for (const [code, room] of rooms) {
      if (!room.players.some((p) => p.id === socket.id)) continue;
      if (room.round?.actorId === socket.id) {
        io.to(code).emit("round_result", { skipped: true, word: room.round.word, reason: "بازیگر خارج شد" });
        room.round = null;
        room.handsPlayed++;
        if (room.handsPlayed >= room.setup.totalRounds) room.phase = "finished";
      }
      removePlayer(room, socket.id);
      if (!room.players.length) {
        rooms.delete(code);
        return;
      }
      broadcastRoom(io, room);
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
    room.handsPlayed++;
    if (room.handsPlayed >= room.setup.totalRounds) room.phase = "finished";
    io.to(room.code).emit("round_result", { timeout: true, word });
    broadcastRoom(io, room);
  }
}, 1000);

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => {
  console.log(`pantomime-fa http://localhost:${PORT}`);
});
