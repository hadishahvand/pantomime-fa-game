/**
 * دانلود لیست خام کلمات از word-list-fa (برای اجرای npm run filter-words).
 * URL: https://github.com/mvalipour/word-list-fa
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "data", "words-full.json");
const url =
  process.env.WORD_LIST_URL ||
  "https://raw.githubusercontent.com/mvalipour/word-list-fa/master/words.json";

const res = await fetch(url);
if (!res.ok) throw new Error(`HTTP ${res.status} برای ${url}`);
const buf = Buffer.from(await res.arrayBuffer());
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buf);
console.log("نوشته شد:", outPath, `(${buf.length} بایت)`);
