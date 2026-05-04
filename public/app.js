const $ = (id) => document.getElementById(id);

const setupBlock = $("setupBlock");
const playBlock = $("playBlock");
const loadError = $("loadError");
const setupError = $("setupError");
const teamName0 = $("teamName0");
const teamName1 = $("teamName1");
const teamRoster0 = $("teamRoster0");
const teamRoster1 = $("teamRoster1");
const teamCount0 = $("teamCount0");
const teamCount1 = $("teamCount1");
const totalRounds = $("totalRounds");
const wordMode = $("wordMode");
const topicId = $("topicId");
const topicWrap = $("topicWrap");
const difficulty = $("difficulty");
const btnStartGame = $("btnStartGame");

const scoreName0 = $("scoreName0");
const scoreName1 = $("scoreName1");
const scoreVal0 = $("scoreVal0");
const scoreVal1 = $("scoreVal1");
const totalScoreSum = $("totalScoreSum");
const turnDetail = $("turnDetail");
const phaseLine = $("phaseLine");
const actorPanel = $("actorPanel");
const actorName = $("actorName");
const actorTeamName = $("actorTeamName");
const wordValueLine = $("wordValueLine");
const btnRevealWord = $("btnRevealWord");
const btnStartTimer = $("btnStartTimer");
const wordReveal = $("wordReveal");
const secretWord = $("secretWord");
const timerEl = $("timer");
const btnSwapWord = $("btnSwapWord");
const btnGuess = $("btnGuess");
const btnSkip = $("btnSkip");
const btnNextRound = $("btnNextRound");
const finishedBar = $("finishedBar");
const finishedText = $("finishedText");
const btnReset = $("btnReset");
const toast = $("toast");

const ROUND_MS = 90_000;

/** امتیاز بر اساس سختی واقعی کلمه (طول) */
const POINTS_BY_BUCKET = { easy: 1, medium: 2, hard: 3 };

/** @type {{ mixed: object, byTopic: object, topicsMeta: {id:string,label:string}[] } | null} */
let POOLS = null;

/** @type {null | { teamNames: string[], rosters: string[][], setup: object, teamScores: number[], handsPlayed: number, teamActorSlot: number[], round: object | null, lastWord: string | null, phase: string }} */
let game = null;

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

function bucketLabelFa(b) {
  return { easy: "آسان", medium: "متوسط", hard: "سخت" }[b] || b;
}

function wordMeta(word) {
  const b = bucketByLength(word);
  return { word, wordBucket: b, wordPoints: POINTS_BY_BUCKET[b] || 1 };
}

function uniq(arr) {
  return [...new Set(arr.map((x) => normalizeFa(x)).filter(Boolean))];
}

function buildPoolsFromFlat(flat) {
  const mixed = { easy: [], medium: [], hard: [], all: [] };
  for (const w of flat) {
    const b = bucketByLength(w);
    mixed[b].push(w);
    mixed.all.push(w);
  }
  return mixed;
}

async function loadBanks() {
  const [gRes, tRes] = await Promise.all([
    fetch("/data/words-game.json"),
    fetch("/data/words-topics.json"),
  ]);
  if (!gRes.ok) throw new Error("بارگذاری words-game.json نشد");
  const flat = uniq(JSON.parse(await gRes.text()));
  const mixed = buildPoolsFromFlat(flat);
  let topicsMeta = [];
  const byTopic = {};
  if (tRes.ok) {
    const raw = JSON.parse(await tRes.text());
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
  }
  POOLS = { mixed, byTopic, topicsMeta, flat };
}

function pickRandom(arr, avoid) {
  const a = arr.filter((w) => w && w !== avoid);
  const src = a.length ? a : arr.filter(Boolean);
  if (!src.length) return "کلمه";
  return src[Math.floor(Math.random() * src.length)];
}

function selectPool() {
  if (!POOLS) return [];
  if (!game) return POOLS.mixed.all;
  const { wordMode, topicId: tid, difficulty: diff } = game.setup;
  const d = diff === "mixed" ? "all" : diff;
  let pool;
  if (wordMode === "topic" && tid && POOLS.byTopic[tid]) {
    pool = POOLS.byTopic[tid][d] || POOLS.byTopic[tid].all;
    if (pool?.length) return pool;
    return POOLS.byTopic[tid].all?.length ? POOLS.byTopic[tid].all : POOLS.mixed.all;
  }
  pool = POOLS.mixed[d] || POOLS.mixed.all;
  return pool?.length ? pool : POOLS.mixed.all;
}

function drawWord() {
  return pickRandom(selectPool(), game?.lastWord ?? null);
}

function showToast(msg, ms = 4500) {
  toast.hidden = !msg;
  toast.textContent = msg || "";
  if (msg) setTimeout(() => { toast.hidden = true; }, ms);
}

function parseRoster(textarea, countInput, teamLabel) {
  const lines = textarea.value
    .split(/\r?\n/)
    .map((l) => normalizeFa(l))
    .filter(Boolean);
  if (lines.length) return lines;
  const n = Math.floor(Number(countInput.value) || 0);
  if (n > 0) {
    return Array.from({ length: n }, (_, i) => `${teamLabel} ${i + 1}`);
  }
  return [];
}

function fillTopicSelect() {
  topicId.innerHTML = "";
  for (const t of POOLS?.topicsMeta || []) {
    const o = document.createElement("option");
    o.value = t.id;
    o.textContent = t.label;
    topicId.appendChild(o);
  }
}

function rosterFromUI() {
  const n0 = normalizeFa(teamName0.value).slice(0, 32) || "تیم الف";
  const n1 = normalizeFa(teamName1.value).slice(0, 32) || "تیم ب";
  const r0 = parseRoster(teamRoster0, teamCount0, n0);
  const r1 = parseRoster(teamRoster1, teamCount1, n1);
  return { teamNames: [n0, n1], rosters: [r0, r1] };
}

function startRound() {
  if (!game || game.phase !== "playing") return;
  if (game.round) return;
  if (game.handsPlayed >= game.setup.totalRounds) {
    game.phase = "finished";
    render();
    return;
  }
  const actingTeam = game.handsPlayed % 2;
  const members = [...game.rosters[actingTeam]];
  if (members.length === 0) return;
  const slot = game.teamActorSlot[actingTeam] % members.length;
  const actor = members[slot];
  game.teamActorSlot[actingTeam]++;
  const rawWord = drawWord();
  game.lastWord = rawWord;
  const { word, wordBucket, wordPoints } = wordMeta(rawWord);
  game.round = {
    actorName: actor,
    actingTeamIndex: actingTeam,
    guessingTeamIndex: 1 - actingTeam,
    word,
    wordBucket,
    wordPoints,
    timerActive: false,
    endsAt: null,
    wordSwapsUsed: 0,
    wordSwapMax: 1,
  };
  wordReveal.classList.add("hidden");
  render();
}

function endHand(reason, extra) {
  if (!game?.round) return;
  const word = game.round.word;
  const guessPts = reason === "guess" ? game.round.wordPoints : 0;
  const guessBucket = reason === "guess" ? game.round.wordBucket : null;
  game.round = null;
  game.handsPlayed++;
  if (game.handsPlayed >= game.setup.totalRounds) game.phase = "finished";
  if (reason === "guess") {
    showToast(
      `${game.teamNames[extra.team]} +${guessPts} امتیاز (${bucketLabelFa(guessBucket || "medium")}). کلمه بود: ${word}`,
    );
  } else if (reason === "timeout") {
    showToast(`وقت تمام شد — بدون امتیاز. کلمه: ${word}`);
  } else if (reason === "skip") {
    showToast(`دست رد شد — بدون امتیاز. کلمه: ${word}`);
  }
  render();
}

function tickTimer() {
  if (!game?.round?.timerActive || !game.round.endsAt) return;
  const left = Math.max(0, Math.ceil((game.round.endsAt - Date.now()) / 1000));
  timerEl.textContent = `${left} ثانیه تا پایان`;
  if (left <= 0) {
    endHand("timeout", {});
  }
}

setInterval(() => {
  if (game?.round?.timerActive) tickTimer();
}, 250);

wordMode.addEventListener("change", () => {
  topicWrap.classList.toggle("hidden", wordMode.value !== "topic");
});

btnStartGame.addEventListener("click", () => {
  setupError.hidden = true;
  if (!POOLS) {
    setupError.textContent = "بانک کلمات هنوز بارگذاری نشده.";
    setupError.hidden = false;
    return;
  }
  if (!window.confirm("بازی با این تنظیمات شروع شود؟")) return;

  const { teamNames, rosters } = rosterFromUI();
  if (rosters[0].length < 1 || rosters[1].length < 1) {
    setupError.textContent = "برای هر تیم حداقل یک نام (یا فقط تعداد) وارد کنید.";
    setupError.hidden = false;
    return;
  }
  const tr = Math.min(50, Math.max(1, Math.floor(Number(totalRounds.value) || 10)));
  const wm = wordMode.value === "topic" ? "topic" : "random";
  const tid = topicId.value;
  const diff = ["easy", "medium", "hard", "mixed"].includes(difficulty.value) ? difficulty.value : "medium";
  game = {
    teamNames,
    rosters,
    setup: { totalRounds: tr, wordMode: wm, topicId: tid, difficulty: diff },
    teamScores: [0, 0],
    handsPlayed: 0,
    teamActorSlot: [0, 0],
    round: null,
    lastWord: null,
    phase: "playing",
  };
  setupBlock.classList.add("hidden");
  playBlock.classList.remove("hidden");
  startRound();
});

btnStartTimer.addEventListener("click", () => {
  if (!game?.round || game.round.timerActive) return;
  game.round.timerActive = true;
  game.round.endsAt = Date.now() + ROUND_MS;
  render();
});

btnRevealWord.addEventListener("click", () => {
  if (!game?.round) return;
  wordReveal.classList.toggle("hidden");
  if (!wordReveal.classList.contains("hidden")) {
    secretWord.textContent = game.round.word;
  }
});

btnSwapWord.addEventListener("click", () => {
  if (!game?.round) return;
  if (game.round.wordSwapsUsed >= game.round.wordSwapMax) return;
  const nwRaw = drawWord();
  game.lastWord = nwRaw;
  const { word, wordBucket, wordPoints } = wordMeta(nwRaw);
  game.round.word = word;
  game.round.wordBucket = wordBucket;
  game.round.wordPoints = wordPoints;
  game.round.wordSwapsUsed++;
  secretWord.textContent = word;
  showToast(`کلمه عوض شد — ارزش جدید: ${wordPoints} (${bucketLabelFa(wordBucket)})`, 2800);
  render();
});

btnGuess.addEventListener("click", () => {
  if (!game?.round?.timerActive) {
    showToast("اول «شروع زمان دست» را بزنید.", 2800);
    return;
  }
  const gt = game.round.guessingTeamIndex;
  const pts = game.round.wordPoints;
  game.teamScores[gt] = (game.teamScores[gt] || 0) + pts;
  endHand("guess", { team: gt });
});

btnSkip.addEventListener("click", () => {
  if (!game?.round) return;
  endHand("skip", {});
});

btnNextRound.addEventListener("click", () => {
  startRound();
});

btnReset.addEventListener("click", () => {
  game = null;
  playBlock.classList.add("hidden");
  setupBlock.classList.remove("hidden");
  finishedBar.classList.add("hidden");
  render();
});

function render() {
  if (!game) return;
  const names = game.teamNames;
  scoreName0.textContent = names[0];
  scoreName1.textContent = names[1];
  const s0 = game.teamScores[0];
  const s1 = game.teamScores[1];
  scoreVal0.textContent = String(s0);
  scoreVal1.textContent = String(s1);
  totalScoreSum.textContent = `جمع امتیازها: ${s0 + s1}`;

  const total = game.setup.totalRounds;
  const done = game.handsPlayed;
  const r = game.round;

  if (game.phase === "finished") {
    turnDetail.classList.add("hidden");
    finishedBar.classList.remove("hidden");
    let t = "";
    if (s0 > s1) t = `${names[0]} برنده است.`;
    else if (s1 > s0) t = `${names[1]} برنده است.`;
    else t = "مساوی!";
    finishedText.textContent = `${t} — ${done} دست — جمع امتیازها: ${s0 + s1}`;
    phaseLine.textContent = "بازی تمام شد.";
    actorPanel.classList.add("hidden");
    btnSkip.classList.add("hidden");
    btnNextRound.classList.add("hidden");
    btnSwapWord.classList.add("hidden");
    btnGuess.disabled = true;
    btnStartTimer.classList.add("hidden");
    return;
  }

  finishedBar.classList.add("hidden");
  btnGuess.disabled = false;

  if (r) {
    const actingName = names[r.actingTeamIndex];
    const guessingName = names[r.guessingTeamIndex];
    const handNo = Math.min(done + 1, total);

    turnDetail.classList.remove("hidden");
    turnDetail.innerHTML = `
      <div><strong>دست ${handNo}</strong> از <strong>${total}</strong></div>
      <div>نوبت <strong>میم</strong>: <strong>${escapeHtml(r.actorName)}</strong> از تیم <strong>«${escapeHtml(actingName)}»</strong> (تیم ${r.actingTeamIndex === 0 ? "اول" : "دوم"})</div>
      <div>تیم <strong>«${escapeHtml(guessingName)}»</strong> (تیم ${r.guessingTeamIndex === 0 ? "اول" : "دوم"}) باید حدس بزند.</div>
      <div class="muted small-rule">بعد از این دست، نوبت میم به تیم دیگر می‌رود (یکی در میان).</div>
    `;

    phaseLine.textContent = r.timerActive
      ? "زمان در حال اجراست — با «درست بود» امتیاز بگیرید یا منتظر پایان زمان بمانید."
      : "زمان هنوز شروع نشده — میم آماده شد؛ دکمهٔ «شروع زمان دست» را بزنید.";

    actorPanel.classList.remove("hidden");
    actorName.textContent = r.actorName;
    actorTeamName.textContent = actingName;
    wordValueLine.textContent = `ارزش این کلمه در صورت حدس درست: ${r.wordPoints} امتیاز (${bucketLabelFa(r.wordBucket)})`;
    secretWord.textContent = r.word;

    const swapsLeft = r.wordSwapsUsed < r.wordSwapMax;
    btnSwapWord.classList.toggle("hidden", !swapsLeft);
    btnSwapWord.textContent = swapsLeft ? "تعویض کلمه (یک بار)" : "تعویض استفاده شد";

    btnStartTimer.classList.toggle("hidden", r.timerActive);
    btnStartTimer.disabled = r.timerActive;

    if (r.timerActive) {
      const left = Math.max(0, Math.ceil((r.endsAt - Date.now()) / 1000));
      timerEl.textContent = `${left} ثانیه تا پایان`;
    } else {
      timerEl.textContent = "زمان شروع نشده";
    }

    btnSkip.classList.remove("hidden");
    btnNextRound.classList.add("hidden");

    btnGuess.disabled = !r.timerActive;
  } else {
    turnDetail.classList.add("hidden");
    if (done >= total) {
      game.phase = "finished";
      render();
      return;
    }
    phaseLine.textContent = `بین دست‌ها — ${done} دست تمام شده از ${total}. برای دست بعد دکمه را بزنید.`;
    actorPanel.classList.add("hidden");
    btnSkip.classList.add("hidden");
    btnNextRound.classList.remove("hidden");
    btnSwapWord.classList.add("hidden");
    btnStartTimer.classList.add("hidden");
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

async function init() {
  teamName0.value = "تیم الف";
  teamName1.value = "تیم ب";
  try {
    await loadBanks();
    fillTopicSelect();
    if (POOLS.topicsMeta[0]) topicId.value = POOLS.topicsMeta[0].id;
  } catch (e) {
    loadError.hidden = false;
    loadError.textContent = String(e.message || e);
  }
}

init();
