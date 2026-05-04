/**
 * فقط سرو استاتیک و بانک کلمات؛ منطق بازی در مرورگر (public/app.js) است.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use("/data", express.static(DATA_DIR));

/** یک JSON واحد تا nginx فقط / را پروکسی کند و /data گم نشود */
app.get("/api/banks", (_req, res) => {
  try {
    const wordsGame = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "words-game.json"), "utf8"));
    let wordsTopics = { topics: [] };
    try {
      wordsTopics = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "words-topics.json"), "utf8"));
    } catch {
      /* اختیاری */
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ wordsGame, wordsTopics });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, mode: "static+client", banks: "/api/banks" });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`pantomime-fa http://localhost:${PORT}`);
});
