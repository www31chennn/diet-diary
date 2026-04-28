# Diet Diary 飲食日記

AI 飲食記錄 Web App，資料同步至 Google Drive，支援 iOS PWA。

## 技術架構

- **框架**: Next.js 14 (App Router)
- **部署**: Vercel
- **Auth**: NextAuth.js + Google OAuth
- **資料儲存**: Google Drive API（存在用戶自己的雲端）
- **AI**: Google Gemini API
- **PWA**: next-pwa（iOS 加入桌面）

---

## 本地開發

```bash
npm install
cp .env.example .env.local
# 填入環境變數後
npm run dev
```

---

## 環境變數設定

### 1. Google OAuth

前往 [Google Cloud Console](https://console.cloud.google.com)：

1. 建立專案 → APIs & Services → Credentials
2. 建立 OAuth 2.0 Client ID（Web application）
3. Authorized redirect URIs 加入：
   - `http://localhost:3000/api/auth/callback/google`（開發）
   - `https://your-app.vercel.app/api/auth/callback/google`（正式）
4. 啟用 Google Drive API

```
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
```

### 2. NextAuth Secret

```bash
openssl rand -base64 32
```

```
NEXTAUTH_SECRET=產生的字串
NEXTAUTH_URL=http://localhost:3000
```

---

## 部署到 Vercel

```bash
npm i -g vercel
vercel
```

在 Vercel Dashboard → Settings → Environment Variables 加入所有 .env 變數，
並將 `NEXTAUTH_URL` 改為你的 Vercel URL。

---

## iOS 加入桌面

1. Safari 開啟 App URL
2. 點下方分享按鈕 →「加入主畫面」
3. 之後從桌面開啟即為全螢幕 App 模式

---

## 資料夾結構

```
app/
├── page.tsx              # 今日儀表板
├── diary/page.tsx         # 飲食記錄
├── exercise/page.tsx      # 運動記錄
├── calendar/page.tsx      # 日曆
├── progress/page.tsx      # 體重/體脂
├── suggestions/page.tsx   # AI 建議
├── settings/page.tsx      # 個人設定
└── api/
    ├── auth/             # NextAuth
    ├── drive/            # Drive 讀寫
    └── gemini/           # Gemini proxy

lib/
├── types.ts              # TypeScript 型別
├── drive.ts              # Drive API helper
└── useStore.ts           # 資料 hooks（含 Drive sync）

components/
├── layout/
│   ├── Providers.tsx     # SessionProvider
│   └── BottomNav.tsx     # 底部導覽
```

---

## Google Drive 資料結構

用戶 Drive 中會自動建立：

```
My Drive/
└── Diet Diary/
    ├── diary-data.json    # 飲食/運動紀錄
    ├── settings.json      # 個人設定
    └── weight-log.json    # 體重/體脂歷史
```

所有資料儲存在**用戶自己的 Google Drive**，開發者無法存取。
