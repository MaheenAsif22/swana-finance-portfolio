# Swana Finance — Frontend

React Native + Expo SDK 54. Runs on **iOS, Android, and Web** from a single codebase.

## Setup

```bash
cd swana-frontend
npm install
```

Copy `.env.example` to `.env` and point it at the backend.

**For web only** (browser on the same machine):
```
EXPO_PUBLIC_API_URL=http://localhost:3001
```

**For a phone running Expo Go** (phone on the same Wi-Fi as your computer):
```
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:3001
```
Find your IP with `ipconfig` (Windows) or `ifconfig` (macOS/Linux) — it'll look like `192.168.x.x`.

## Run

```bash
npm start
```

Then choose how to open it:

- **Web:** press `w` — opens in your default browser
- **Phone (Expo Go):**
  - Install **Expo Go** from Play Store (Android) / App Store (iPhone)
  - Make sure your phone is on the same Wi-Fi as your computer
  - Scan the QR code shown in the terminal
    - Android: open Expo Go → Scan QR code
    - iPhone: open the Camera app → point at QR → tap the banner
- **Android emulator:** press `a` (requires Android Studio set up)
- **iOS simulator:** press `i` (macOS + Xcode only)

## Demo logins

| username | PIN  |
|----------|------|
| usman    | 1234 |
| zahid    | 0000 |
| shazada  | 0000 |

## Project structure

```
swana-frontend/
├── App.js                       # Root component
├── index.js                     # Entry point (registerRootComponent)
├── app.json                     # Expo config
├── babel.config.js
├── metro.config.js
├── src/
│   ├── api/                     # axios client + endpoint modules
│   ├── components/              # Reusable UI components
│   ├── hooks/                   # Custom hooks
│   ├── navigation/              # React Navigation stack/tab setup
│   ├── screens/                 # Screen components
│   ├── store/                   # Zustand stores (auth, transactions)
│   └── utils/
│       ├── storage.js           # Cross-platform persistent storage
│       │                        # (SecureStore on native, localStorage on web)
│       ├── format.js
│       └── theme.js
```

## Notes

- Token storage uses **expo-secure-store** on iOS/Android (encrypted keychain) and **localStorage** on web. Both are wrapped behind `src/utils/storage.js` so app code stays platform-agnostic.
- This project targets Expo SDK 54 (React Native 0.81, React 19.1).
- Node 20.19.4+ is required (Node 24 also works).
