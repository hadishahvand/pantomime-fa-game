const $ = (id) => document.getElementById(id);

const gate = $("gate");
const lobby = $("lobby");
const gateError = $("gateError");
const playerName = $("playerName");
const roomCode = $("roomCode");
const displayCode = $("displayCode");
const playerList = $("playerList");
const youHost = $("youHost");
const hostControls = $("hostControls");
const btnCreate = $("btnCreate");
const btnJoin = $("btnJoin");
const btnStart = $("btnStart");
const btnGuess = $("btnGuess");
const guessInput = $("guessInput");
const guessBox = $("guessBox");
const actorPanel = $("actorPanel");
const secretWord = $("secretWord");
const timerEl = $("timer");
const btnSkip = $("btnSkip");
const toast = $("toast");
const hostHint = $("hostHint");

let socket;
let myId = null;
let state = null;

function showError(msg) {
  gateError.hidden = !msg;
  gateError.textContent = msg || "";
}

function showToast(msg, ms = 5000) {
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
    render();
  });
  socket.on("round_result", (r) => {
    if (r.winnerId) {
      const winner = state?.players?.find((p) => p.id === r.winnerId);
      showToast(`${winner?.name || "یک نفر"} درست حدس زد: ${r.word}`);
    } else if (r.timeout) {
      showToast(`وقت تمام شد. کلمه: ${r.word}`);
    } else if (r.skipped) {
      showToast(`دست رد شد. کلمه: ${r.word}`);
    }
    guessInput.value = "";
  });
}

function render() {
  if (!state) return;
  gate.classList.add("hidden");
  lobby.classList.remove("hidden");
  displayCode.textContent = state.code;
  const amHost = state.hostId === myId;
  youHost.classList.toggle("hidden", !amHost);
  hostControls.classList.toggle("hidden", !amHost);
  const playersOk = (state.players?.length || 0) >= 2;
  const canStartRound = amHost && playersOk && !state.round;
  btnStart.classList.toggle("hidden", !canStartRound);
  if (amHost) {
    hostHint.classList.remove("hidden");
    if (!playersOk) {
      hostHint.textContent = "برای شروع، حداقل یک نفر دیگر باید با کد اتاق وارد شود.";
    } else if (state.round) {
      hostHint.textContent = "دست در جریان است؛ بعد از تمام شدن، دکمهٔ شروع را بزنید.";
    } else {
      hostHint.textContent = "نوبت میم بین بازیکنان می‌چرخد. دکمه را بزنید تا دست جدید شروع شود.";
    }
  } else {
    hostHint.classList.add("hidden");
    hostHint.textContent = "";
  }

  playerList.innerHTML = "";
  for (const p of state.players || []) {
    const li = document.createElement("li");
    const mark = p.id === state.hostId ? " (میزبان)" : "";
    const me = p.id === myId ? " — شما" : "";
    li.innerHTML = `<span>${escapeHtml(p.name)}${mark}${me}</span><span class="score">${p.score ?? 0}</span>`;
    playerList.appendChild(li);
  }

  const r = state.round;
  const amActor = r && r.actorId === myId;
  guessBox.classList.toggle("hidden", !r || amActor);
  actorPanel.classList.toggle("hidden", !r || !amActor);
  btnSkip.classList.toggle("hidden", !r || (!amHost && !amActor));

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
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

btnStart.addEventListener("click", () => {
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

connect();
