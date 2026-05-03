/**
 * فقط سرو استاتیک و بانک کلمات؛ منطق بازی در مرورگر (public/app.js) است.
 */
import path from "path";
import { fileURLToPath } from "url";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use("/data", express.static(path.join(__dirname, "data")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, mode: "static+client" });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`pantomime-fa http://localhost:${PORT}`);
});
