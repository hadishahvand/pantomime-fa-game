const $ = (id) => document.getElementById(id);

const gate = $("gate");
const lobby = $("lobby");
const gateError = $("gateError");
const playerName = $("playerName");
const roomCode = $("roomCode");
const displayCode = $("displayCode");
const playerList = $("playerList");
const youHost = $("youHost");
const btnCreate = $("btnCreate");
const btnJoin = $("btnJoin");
const btnGuess = $("btnGuess");
const guessInput = $("guessInput");
const guessBox = $("guessBox");
const actorPanel = $("actorPanel");
const secretWord = $("secretWord");
const timerEl = $("timer");
const btnSkip = $("btnSkip");
const toast = $("toast");
const hostHint = $("hostHint");
const setupPanel = $("setupPanel");
const teamName0 = $("teamName0");
const teamName1 = $("teamName1");
const totalRounds = $("totalRounds");
const wordMode = $("wordMode");
const topicId = $("topicId");
const topicWrap = $("topicWrap");
const difficulty = $("difficulty");
const btnSaveSetup = $("btnSaveSetup");
const btnStartGame = $("btnStartGame");
const btnTeam0 = $("btnTeam0");
const btnTeam1 = $("btnTeam1");
const scoreBoard = $("scoreBoard");
const scoreName0 = $("scoreName0");
const scoreName1 = $("scoreName1");
const scoreVal0 = $("scoreVal0");
const scoreVal1 = $("scoreVal1");
const phaseLine = $("phaseLine");
const hostPlayControls = $("hostPlayControls");
const btnNextRound = $("btnNextRound");
const btnSwapWord = $("btnSwapWord");
const finishedBar = $("finishedBar");
const finishedText = $("finishedText");
const btnResetLobby = $("btnResetLobby");

let socket;
let myId = null;
let state = null;

function showError(msg) {
  gateError.hidden = !msg;
  gateError.textContent = msg || "";
}

function showToast(msg, ms = 5500) {
  toast.hidden = !msg;
  toast.textContent = msg || "";
  if (msg) setTimeout(() => { toast.hidden = true; }, ms);
}

function connect() {
  socket = io({ transports: ["websocket", "polling"] });
  socket.on("connect", () => {
    myId = socket.id;
  });
  socket.on("room_state", (s) => {
    state = s;
    syncSetupFormFromState();
    render();
  });
  socket.on("round_result", (r) => {
    const names = state?.setup?.teamNames || ["تیم ۱", "تیم ۲"];
    if (r.winnerId != null && r.teamIndex != null) {
      const w = state?.players?.find((p) => p.id === r.winnerId);
      showToast(`${w?.name || "یک نفر"} برای ${names[r.teamIndex]} امتیاز گرفت. کلمه: ${r.word}`);
    } else if (r.timeout) {
      showToast(`وقت تمام شد. کلمه: ${r.word}`);
    } else if (r.skipped) {
      showToast(`دست رد شد. کلمه: ${r.word}`);
    }
    guessInput.value = "";
  });
}

function syncSetupFormFromState() {
  if (!state?.setup) return;
  const s = state.setup;
  teamName0.value = s.teamNames?.[0] ?? "";
  teamName1.value = s.teamNames?.[1] ?? "";
  totalRounds.value = String(s.totalRounds ?? 10);
  wordMode.value = s.wordMode === "topic" ? "topic" : "random";
  difficulty.value = s.difficulty || "medium";
  topicId.innerHTML = "";
  for (const t of state.topicsMeta || []) {
    const o = document.createElement("option");
    o.value = t.id;
    o.textContent = t.label;
    topicId.appendChild(o);
  }
  if (s.topicId && [...topicId.options].some((o) => o.value === s.topicId)) {
    topicId.value = s.topicId;
  }
  topicWrap.classList.toggle("hidden", wordMode.value !== "topic");
}

function render() {
  if (!state) return;
  gate.classList.add("hidden");
  lobby.classList.remove("hidden");
  displayCode.textContent = state.code;
  const amHost = state.hostId === myId;
  youHost.classList.toggle("hidden", !amHost);

  const names = state.setup?.teamNames || ["تیم ۱", "تیم ۲"];
  scoreName0.textContent = names[0];
  scoreName1.textContent = names[1];
  scoreVal0.textContent = String(state.teamScores?.[0] ?? 0);
  scoreVal1.textContent = String(state.teamScores?.[1] ?? 0);

  const phase = state.phase || "setup";
  scoreBoard.classList.toggle("hidden", phase === "setup");
  phaseLine.classList.toggle("hidden", phase === "setup");
  setupPanel.classList.toggle("hidden", !amHost || phase !== "setup");
  finishedBar.classList.toggle("hidden", phase !== "finished");

  if (phase === "playing" || phase === "finished") {
    const total = state.setup?.totalRounds ?? 0;
    const done = state.handsPlayed ?? 0;
    if (phase === "finished") {
      phaseLine.textContent = `بازی تمام شد — ${done} دست از ${total}`;
    } else if (r) {
      const an = names[r.actingTeamIndex];
      const gn = names[r.guessingTeamIndex];
      phaseLine.textContent = `دست ${Math.min(done + 1, total)} از ${total} — میم: ${an} / حدس: ${gn}`;
    } else {
      phaseLine.textContent = `دست بعدی (${Math.min(done + 1, total)} از ${total}) — آمادهٔ شروع با دکمهٔ میزبان`;
    }
  }

  if (phase === "finished") {
    const s0 = state.teamScores?.[0] ?? 0;
    const s1 = state.teamScores?.[1] ?? 0;
    let t = "";
    if (s0 > s1) t = `${names[0]} برنده است.`;
    else if (s1 > s0) t = `${names[1]} برنده است.`;
    else t = "مساوی!";
    finishedText.textContent = t;
  }

  playerList.innerHTML = "";
  for (const p of state.players || []) {
    const li = document.createElement("li");
    const mark = p.id === state.hostId ? " میزبان" : "";
    const me = p.id === myId ? " — شما" : "";
    const ti = p.teamIndex === 0 || p.teamIndex === 1 ? names[p.teamIndex] : "بدون تیم";
    li.innerHTML = `<span>${escapeHtml(p.name)}${mark}${me}<br/><small class="muted">${escapeHtml(ti)}</small></span>`;
    playerList.appendChild(li);
  }

  const r = state.round;
  const amActor = r && r.actorId === myId;
  const my = state.players?.find((p) => p.id === myId);
  const canGuess = r && my && my.teamIndex === r.guessingTeamIndex && !amActor;

  guessBox.classList.toggle("hidden", !canGuess);
  actorPanel.classList.toggle("hidden", !r || !amActor);
  btnSkip.classList.toggle("hidden", !r || (!amHost && !amActor));

  const swapsLeft = r && r.wordSwapsUsed < r.wordSwapMax;
  btnSwapWord.classList.toggle("hidden", !r || !(amActor || amHost) || !swapsLeft);
  btnSwapWord.textContent =
    r && r.wordSwapsUsed >= r.wordSwapMax ? "تعویض کلمه استفاده شد" : "تعویض کلمه (یک بار)";

  if (r && amActor) {
    secretWord.textContent = r.word || "…";
  }

  if (r?.endsAt) {
    const tick = () => {
      const left = Math.max(0, Math.ceil((r.endsAt - Date.now()) / 1000));
      timerEl.textContent = `${left} ثانیه`;
    };
    tick();
    clearInterval(window.__pantomimeTimer);
    window.__pantomimeTimer = setInterval(tick, 250);
  } else {
    clearInterval(window.__pantomimeTimer);
    timerEl.textContent = "";
  }

  const playersOk = (state.players?.length || 0) >= 2;
  const canNext =
    amHost && phase === "playing" && !r && playersOk && (state.handsPlayed ?? 0) < (state.setup?.totalRounds ?? 0);
  hostPlayControls.classList.toggle("hidden", !canNext);
  btnNextRound.classList.toggle("hidden", !canNext);

  if (amHost) {
    hostHint.classList.remove("hidden");
    if (phase === "setup") {
      hostHint.textContent = "تیم‌ها و تعداد دست و کلمه را تنظیم کن؛ بعد «شروع بازی».";
    } else if (phase === "playing") {
      if (r) hostHint.textContent = "دست در جریان است.";
      else if ((state.handsPlayed ?? 0) >= (state.setup?.totalRounds ?? 0)) hostHint.textContent = "بازی تمام شده.";
      else hostHint.textContent = "برای دست بعدی «دست بعدی» را بزن.";
    } else {
      hostHint.textContent = "می‌توانی «بازی جدید» بزنی تا دوباره تنظیم کنید.";
    }
  } else {
    hostHint.classList.add("hidden");
    hostHint.textContent = "";
  }

  btnResetLobby.classList.toggle("hidden", !amHost || phase !== "finished");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

wordMode.addEventListener("change", () => {
  topicWrap.classList.toggle("hidden", wordMode.value !== "topic");
});

btnCreate.addEventListener("click", () => {
  const name = playerName.value.trim();
  if (!name) {
    showError("نام را وارد کنید.");
    return;
  }
  showError("");
  if (!socket) connect();
  socket.emit("create_room", name, (res) => {
    if (!res?.ok) showError(res?.error || "خطا");
  });
});

btnJoin.addEventListener("click", () => {
  const name = playerName.value.trim();
  const code = roomCode.value.trim().toUpperCase();
  if (!name) {
    showError("نام را وارد کنید.");
    return;
  }
  if (!code) {
    showError("کد اتاق را وارد کنید.");
    return;
  }
  showError("");
  if (!socket) connect();
  socket.emit("join_room", { code, name }, (res) => {
    if (!res?.ok) showError(res?.error || "خطا");
  });
});

function emitSetup() {
  socket.emit(
    "update_setup",
    {
      teamNames: [teamName0.value.trim(), teamName1.value.trim()],
      totalRounds: Number(totalRounds.value),
      wordMode: wordMode.value,
      topicId: topicId.value,
      difficulty: difficulty.value,
    },
    (res) => {
      if (!res?.ok) showToast(res?.error || "ذخیره نشد");
      else showToast("تنظیمات ذخیره شد.", 2500);
    },
  );
}

btnSaveSetup.addEventListener("click", () => emitSetup());

btnStartGame.addEventListener("click", () => {
  emitSetup();
  socket.emit("start_game", (res) => {
    if (!res?.ok) showToast(res?.error || "شروع نشد");
  });
});

btnTeam0.addEventListener("click", () => socket.emit("pick_team", { teamIndex: 0 }));
btnTeam1.addEventListener("click", () => socket.emit("pick_team", { teamIndex: 1 }));

btnNextRound.addEventListener("click", () => {
  socket.emit("start_round");
});

btnGuess.addEventListener("click", () => {
  const t = guessInput.value.trim();
  if (t) socket.emit("guess", t);
});

guessInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnGuess.click();
});

btnSkip.addEventListener("click", () => {
  socket.emit("skip_round");
});

btnSwapWord.addEventListener("click", () => {
  socket.emit("swap_word", (res) => {
    if (!res?.ok) showToast(res?.error || "امکان تعویض نیست", 3000);
  });
});

btnResetLobby.addEventListener("click", () => {
  socket.emit("reset_lobby", (res) => {
    if (!res?.ok) showToast("انجام نشد");
  });
});

connect();
