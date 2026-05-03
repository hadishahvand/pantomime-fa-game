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

جزئیات کامل در بخش بعد؛ خلاصه:

```bash
git clone https://github.com/USERNAME/REPONAME.git
cd REPONAME
npm ci
npm start
```

## استقرار روی VPS (بعد از push به GitHub)

فرض: اوبونتو ۲۲/۲۴، یک زیردامنه مثل `game.example.com` به IP سرور اشاره می‌کند.

### ۱) DNS

در پنل دامنه، رکورد **A** برای `game.example.com` → **IP عمومی سرور**.

### ۲) نصب Node و ابزارها (روی سرور)

```bash
sudo apt update && sudo apt install -y git nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v
```

### ۳) کلون و نصب پروژه

```bash
sudo mkdir -p /var/www && sudo chown "$USER":"$USER" /var/www
cd /var/www
git clone https://github.com/USERNAME/REPONAME.git pantomime-fa-game
cd pantomime-fa-game
npm ci
```

(برای ریپوی خصوصی: روی سرور **Deploy key** یا **PAT** تنظیم کن تا `git clone` کار کند.)

### ۴) PM2 (اجرای دائمی)

از داخل همان پوشهٔ پروژه:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u "$USER" --hp "$HOME"
```

خروجی آخر یک دستور `sudo env ...` می‌دهد؛ **همان را یک‌بار اجرا کن** تا بعد از ریبوت هم بالا بیاید.

برنامه روی پورت **۳۰۰۰** گوش می‌دهد (`ecosystem.config.cjs`). تست:

```bash
curl -s http://127.0.0.1:3000/health
```

### ۵) Nginx + SSL

فایل `deploy/nginx.example.conf` را کپی کن، `game.example.com` را با دامنهٔ خودت عوض کن، مثلاً:

```bash
sudo cp deploy/nginx.example.conf /etc/nginx/sites-available/pantomime-fa
sudo nano /etc/nginx/sites-available/pantomime-fa
sudo ln -sf /etc/nginx/sites-available/pantomime-fa /etc/nginx/sites-enabled/
sudo nginx -t
```

فعلاً بلوک `listen 443` را **موقتاً** کامنت کن یا فقط بلوک پورت ۸۰ را برای certbot نگه دار؛ ساده‌ترین مسیر:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo systemctl reload nginx
sudo certbot --nginx -d game.example.com
```

Certbot معمولاً SSL را به تنظیمات nginx اضافه می‌کند. دوباره `sudo nginx -t` و `sudo systemctl reload nginx`.

### ۶) فایروال

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Node را روی اینترنت باز نکن؛ فقط Nginx روی ۸۰/۴۴۳ باشد و به `127.0.0.1:3000` پروکسی کند.

### ۷) آپدیت بعد از تغییر در GitHub

```bash
cd /var/www/pantomime-fa-game
git pull
npm ci
pm2 restart pantomime-fa
```

### CDN (مثلاً Cloudflare)

حالت SSL **Full (strict)**. برای همین دامنه **Page Rule** یا **Cache Rule**: کش را برای مسیرهای اپ **Bypass** کن (حداقل `/` و در صورت نیاز `/socket.io/*`) تا نسخهٔ قدیمی یا مشکل WebSocket پیش نیاید.

## ساختار پروژه

| مسیر | توضیح |
|------|--------|
| `server.js` | Express + Socket.IO |
| `public/` | رابط کاربری (RTL) |
| `data/words-game.json` | لیست کلمات بازی |
| `scripts/` | `fetch-words` و `filter-words` |
| `ecosystem.config.cjs` | تنظیم PM2 برای production |
| `deploy/nginx.example.conf` | نمونهٔ پروکسی + WebSocket |

## مجوز

کد این ریپو را می‌توانی آزادانه برای پروژهٔ خودت استفاده کنی. لیست کلمات خام از ریپوی `word-list-fa` گرفته شده؛ برای شرایط دقیق آن فایل، همان ریپو را ببین.
