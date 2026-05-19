# Swana Finance — Phase 3

Two-part project: a Node.js backend API and a React Native (Expo) frontend that runs on **phone (iOS/Android) and in the browser** from one codebase.

```
swana-phase3-final/
├── swana-backend/    # Node.js + Express + SQLite API  (port 3001)
└── swana-frontend/   # React Native + Expo SDK 54
```

## Quickstart (Windows / macOS / Linux)

### Prerequisites
- **Node.js 20.19.4 or newer** (Node 24 also works) — https://nodejs.org
- **VS Code** — https://code.visualstudio.com
- For phone testing: the **Expo Go** app on your phone

### 1. Open the project
Extract the zip, then `File → Open Folder` in VS Code on the extracted `swana-phase3-final` folder.

### 2. Start the backend (terminal 1)

In VS Code: `Terminal → New Terminal`.

```bash
cd swana-backend
npm install
```

Copy `.env.example` to `.env` (right-click the file → Copy → Paste → Rename to `.env`).
Open `.env` and set `JWT_SECRET` to any long random string:
```
JWT_SECRET=mysupersecretkey1234567890abcdefg
```

Then:
```bash
npm run seed
npm run dev
```

You should see `Swana Finance API` and `http://localhost:3001/api/health`. **Leave this terminal running.**

### 3. Start the frontend (terminal 2)

Open a second terminal in VS Code (click `+` in the terminal panel).

```bash
cd swana-frontend
npm install
```

This takes 2-5 minutes the first time. Then create a `.env` file in `swana-frontend/`:

**For browser only:**
```
EXPO_PUBLIC_API_URL=http://localhost:3001
```

**For phone (Expo Go):** find your IP with `ipconfig` (Windows) or `ifconfig` (Mac/Linux), then:
```
EXPO_PUBLIC_API_URL=http://192.168.x.x:3001
```
(Phone and computer must be on the **same Wi-Fi**.)

Start Expo:
```bash
npm start
```

### 4. Open the app

When you see the QR code and key options in the terminal:

- **Browser:** press `w` — opens in your default browser
- **Phone:** scan the QR with Expo Go (Android: in-app scanner; iPhone: Camera app)
- **Android emulator:** press `a` (requires Android Studio)
- **iOS simulator:** press `i` (Mac + Xcode only)

### 5. Log in

| username | PIN  | role    |
|----------|------|---------|
| usman    | 1234 | owner   |
| zahid    | 0000 | cashier |
| shazada  | 0000 | cashier |

## Troubleshooting

**`npm install` in the backend fails on `better-sqlite3`**
This project pins `better-sqlite3@^12` which ships prebuilt binaries for Node 18/20/22/24 on Windows — no C++ compiler needed. If you still see compile errors, confirm your Node version is ≥ 18 and try `npm install better-sqlite3@latest`.

**Phone shows "Network request failed" on login**
Your `EXPO_PUBLIC_API_URL` is wrong, or phone/computer are on different networks. Re-check the IP with `ipconfig` and confirm it starts with `http://`, not `https://`. Also confirm the backend terminal is still running.

**Web shows a blank screen**
Open DevTools (F12) and check the Console. If you see network errors, it's a CORS or URL issue — verify the backend is running and `EXPO_PUBLIC_API_URL` is correct.

**Expo Go says "incompatible with this SDK version"**
This project uses SDK 54, which is the current public Expo Go version. If your Expo Go is somehow older, update it from the app store.

**Reset the database**
```bash
cd swana-backend
npm run reset
```

## WhatsApp import (owner-only feature)

The app can ingest exported WhatsApp chats from your finance group and turn them into structured transactions in the ledger. The system was trained on 5 years of real chat history; it recognizes ~336 canonical payees (including spelling variants like Quddos/Quddus/Qudoos), and ~10 expense categories.

**Workflow:**
1. Log in as `usman` (owner). The Dashboard shows two new tools: **Import from WhatsApp** and **Payee dictionary**.
2. **Export the chat:** WhatsApp group → tap the name → Export chat → Without media → save the `.txt`.
3. **In the app:** tap "Import from WhatsApp" → paste the chat or pick the .txt file → tap Parse.
4. **Review:** every parsed transaction is shown with payee/category/type auto-filled. Rows flagged "needs review" have low confidence. Tap any row to edit. Mark rows as "skip" to exclude.
5. **Commit:** writes everything to the database. Imported rows are tagged so you can filter "imported vs entered" later.

**Re-training the brain** (optional, if you upload a much bigger chat history later):
```bash
cd swana-backend
node src/import/analyzer.js path/to/your-chat.txt
```
This regenerates `knowledge/payees.json` and `knowledge/categories.json`. New imports use the updated knowledge automatically.

**Editing the payee dictionary:**
Tap "Payee dictionary" on the Dashboard. Search, rename, split clusters apart (when the auto-clusterer wrongly merged two different people), or delete junk clusters. Changes are persisted to `knowledge/payees.json`.

## Tech stack

- **Backend:** Node.js, Express, SQLite (`better-sqlite3` v12), JWT auth, bcrypt
- **Frontend:** Expo SDK 54, React Native 0.81, React 19.1, React Navigation 7, Zustand, Axios
- **Import engine:** zero-dependency regex parser + fuzzy clustering + learned keyword dictionary (no ML, fully explainable)
