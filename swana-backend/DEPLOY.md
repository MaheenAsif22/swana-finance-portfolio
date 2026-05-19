# Swana Finance — Deployment Guide

---

## Option A: Render (Backend) + Vercel (Web) — Recommended

### Backend → Render (free tier, persistent disk)

1. Push `swana-backend/` to a GitHub repo
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect repo → Render detects `render.yaml` automatically
4. Set env vars under **Environment**:
   ```
   JWT_SECRET    = <run: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
   ALLOWED_ORIGINS = https://swana-finance.vercel.app
   ```
5. Click **Deploy** → note your URL: `https://swana-finance-api.onrender.com`

### Frontend (Web) → Vercel

1. Push `swana-frontend/` to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import repo
3. Set env var:
   ```
   EXPO_PUBLIC_API_URL = https://swana-finance-api.onrender.com
   ```
4. Build command: `npx expo export --platform web`  
   Output dir: `dist`
5. Click **Deploy**

---

## Option B: Railway (Backend) — Simpler

1. Install Railway CLI: `npm i -g @railway/cli`
2. ```bash
   cd swana-backend
   railway login
   railway init          # create project
   railway up            # deploy
   railway variables set JWT_SECRET=<secret> NODE_ENV=production
   railway open          # get your URL
   ```
3. Set `ALLOWED_ORIGINS` to your frontend URL
4. Run seed once: `railway run node database/seed.js`

---

## Option C: Docker / VPS (Self-hosted)

```bash
# 1. Copy files to server
scp -r swana-backend/ user@your-server:/app/swana-backend
ssh user@your-server

# 2. Create .env
cd /app/swana-backend
cp .env.production.example .env
nano .env   # fill in JWT_SECRET and ALLOWED_ORIGINS

# 3. Run
docker compose up -d

# 4. Optional: Nginx reverse proxy
# proxy_pass http://localhost:3001;
```

### VPS without Docker (PM2)

```bash
cd swana-backend
npm ci --omit=dev
npm run seed
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save && pm2 startup   # auto-start on reboot
```

---

## Mobile App → Expo EAS Build

### Prerequisites
```bash
npm install -g eas-cli
eas login
```

### Update backend URL in eas.json
```json
"production": {
  "env": { "EXPO_PUBLIC_API_URL": "https://your-backend-url" }
}
```

### Build

```bash
cd swana-frontend

# Android APK (internal testing)
eas build --platform android --profile preview

# iOS (requires Apple Developer account $99/yr)
eas build --platform ios --profile production

# Both
eas build --platform all --profile production
```

### Submit to stores
```bash
eas submit --platform android --profile production
eas submit --platform ios     --profile production
```

---

## Environment Variable Summary

### Backend `.env`
| Variable | Required | Example |
|---|---|---|
| `JWT_SECRET` | ✅ | 64-char random hex |
| `JWT_EXPIRES_IN` | ✅ | `30d` |
| `ALLOWED_ORIGINS` | ✅ | `https://yourapp.vercel.app` |
| `PORT` | optional | `3001` |
| `NODE_ENV` | optional | `production` |

### Frontend `.env`
| Variable | Required | Example |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | ✅ | `https://yourbackend.onrender.com` |

---

## Verify Production

```bash
# Health check
curl https://your-backend.onrender.com/api/health

# Login
curl -X POST https://your-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"usman","pin":"1234"}'
```

---

## Pre-Production Checklist

- [ ] `JWT_SECRET` is a long random string (not the default)
- [ ] `ALLOWED_ORIGINS` matches your actual frontend domain
- [ ] `NODE_ENV=production` is set
- [ ] Backend `/api/health` returns 200
- [ ] Frontend can login and load dashboard
- [ ] Change default user PINs in production (via seed or direct DB update)
