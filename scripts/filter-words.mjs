import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const raw = JSON.parse(fs.readFileSync(path.join(root, "data", "words-full.json"), "utf8"));

const faOnly = /^[\u0600-\u06FF\u200C]+$/;
const badEndings = /^(آخ|آه|ای|او|تو|ما|یا|نه|بله|چی|که|را|از|به|در|با|بر|تا|این|آن)$/;

function normalize(w) {
  return String(w)
    .replace(/\u200c/g, "")
    .replace(/\u064a/g, "\u06cc")
    .replace(/\u0643/g, "\u06a9")
    .trim();
}

const seen = new Set();
const out = [];
for (const w0 of raw) {
  const w = normalize(w0);
  if (w.length < 3 || w.length > 12) continue;
  if (!faOnly.test(w)) continue;
  if (badEndings.test(w)) continue;
  if (seen.has(w)) continue;
  seen.add(w);
  out.push(w);
}

// ترجیح کلمات کوتاه‌تر برای پانتومیم
out.sort((a, b) => a.length - b.length || a.localeCompare(b, "fa"));
const capped = out.slice(0, 4000);
fs.writeFileSync(path.join(root, "data", "words-game.json"), JSON.stringify(capped, null, 0), "utf8");
console.log("words-game.json:", capped.length);
