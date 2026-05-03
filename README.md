# پانتومیم آنلاین (فارسی)

بازی گروهی: یک نفر کلمه را می‌بیند و با حرکت بدون صحبت نشان می‌دهد؛ بقیه در چت حدس می‌زنند. اتاق با **کد پنج حرفی**، ارتباط زنده با **Socket.IO**.

## اجرای محلی

نیاز: **Node.js 18+**

```bash
npm install
npm start
```

مرورگر: `http://localhost:3000` (پورت با متغیر `PORT` عوض می‌شود.)

بررسی سلامت: `http://localhost:3000/health`

## کلمات بازی

فایل `data/words-game.json` داخل ریپو قرار دارد و برای بازی کافی است.

اگر خواستی دوباره از منبع بسازی:

```bash
npm run rebuild-words
```

(ابتدا `words-full.json` را می‌گیرد، بعد `words-game.json` را می‌سازد.) منبع: [mvalipour/word-list-fa](https://github.com/mvalipour/word-list-fa) — جزئیات در `data/SOURCE.txt`.

## بردن پروژه روی GitHub (گام‌به‌گام)

### ۱) ساخت ریپو در سایت GitHub

1. وارد [github.com](https://github.com) شو و لاگین کن.
2. بالا راست **+** → **New repository**.
3. نام ریپو را بزن (مثلاً `pantomime-fa-game`).
4. **Public** یا **Private** را انتخاب کن.
5. تیک «Add a README» را **نزن** (ما از قبل README داریم)؛ Create repository.

صفحه بعدی آدرس `git@github.com:USERNAME/REPONAME.git` یا HTTPS را نشان می‌دهد؛ همان را برای مرحلهٔ ۴ لازم داری.

### ۲) Git روی کامپیوتر خودت

اگر داخل پوشهٔ پروژه هنوز گیت نداری:

```bash
cd /مسیر/پوشه/pantomime-fa-game
git init
git add .
git commit -m "اولین نسخه: پانتومیم آنلاین فارسی"
```

اگر از قبل `.git` داری، فقط:

```bash
git add .
git status   # بررسی کن چه چیزی commit می‌شود
git commit -m "به‌روزرسانی پروژه"
```

### ۳) اتصال به GitHub

**با HTTPS** (ساده‌تر؛ GitHub گاهی توکن می‌خواهد):

```bash
git branch -M main
git remote add origin https://github.com/USERNAME/REPONAME.git
git push -u origin main
```

`USERNAME` و `REPONAME` را با نام کاربری و نام ریپوی خودت عوض کن.

اولین `push` ممکن است نام کاربری و **Personal Access Token** (به‌جای رمز GitHub) بخواهد:  
GitHub → **Settings** → **Developer settings** → **Personal access tokens** → توکن با دسترسی `repo` بساز.

**با SSH** (اگر کلید SSH ساختی):

```bash
git branch -M main
git remote add origin git@github.com:USERNAME/REPONAME.git
git push -u origin main
```

### ۴) آپدیت بعد از تغییر کد

```bash
git add .
git commit -m "توضیح کوتاه تغییر"
git push
```

### ۵) روی سرور بعد از push

```bash
git clone https://github.com/USERNAME/REPONAME.git
cd REPONAME
npm ci
npm start
# یا pm2: pm2 start server.js --name pantomime-fa
```

نمونهٔ **Nginx** برای HTTPS و WebSocket در پوشهٔ `deploy/nginx.example.conf` است.

## ساختار پروژه


| مسیر                   | توضیح                          |
| ---------------------- | ------------------------------ |
| `server.js`            | Express + Socket.IO            |
| `public/`              | رابط کاربری (RTL)              |
| `data/words-game.json` | لیست کلمات بازی                |
| `scripts/`             | `fetch-words` و `filter-words` |


## مجوز

کد این ریپو را می‌توانی آزادانه برای پروژهٔ خودت استفاده کنی. لیست کلمات خام از ریپوی `word-list-fa` گرفته شده؛ برای شرایط دقیق آن فایل، همان ریپو را ببین.