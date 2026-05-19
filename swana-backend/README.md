# Swana Finance — Backend API

Node.js + Express + SQLite (better-sqlite3) + JWT.

## Setup

```bash
cd swana-backend
npm install
```

Copy `.env.example` to `.env` and set a long random `JWT_SECRET`:

```
PORT=3001
JWT_SECRET=mysupersecretkey1234567890abcdefg
JWT_EXPIRES_IN=30d
NODE_ENV=development
```

Seed the database (creates `swana.db` with demo users + sample data):

```bash
npm run seed
```

Run the server:

```bash
npm run dev       # auto-reload during development
# or
npm start         # production
```

Server: `http://localhost:3001`
Health check: `http://localhost:3001/api/health`

## Demo logins

| username | PIN  | role    |
|----------|------|---------|
| usman    | 1234 | owner   |
| zahid    | 0000 | cashier |
| shazada  | 0000 | cashier |

## Reset

`npm run reset` wipes the DB and re-seeds.

## Notes

- `better-sqlite3` v11+ ships prebuilt binaries for Node 18, 20, 22, and 24, so no C++ compiler is needed on Windows.
- CORS allows `localhost:8081` (Expo web) and `localhost:19006` by default. Set `ALLOWED_ORIGINS` in `.env` for production.
