# Flashcard Web App — Design Spec

## Overview

A standalone web application for creating and studying vocabulary flashcard sets, hosted at elvishka.com. Users register with username/password, create card sets (individually or in bulk via textarea with validation), and study using flashcard flip and multiple-choice test modes. Replaces the previous Telegram bot approach.

## Stack

- **Runtime**: Node.js 20
- **Backend**: Fastify (REST API + static file serving)
- **Frontend**: React + Vite (SPA)
- **Database**: SQLite via better-sqlite3
- **Auth**: bcrypt (password hashing) + JWT (httpOnly cookie sessions)
- **Deployment**: Docker (multi-stage build), GitHub Actions CI/CD, Hetzner VM, Cloudflare proxy for SSL

## Architecture

Single Docker container:

1. **Fastify HTTP server** — serves React SPA as static files + REST API
2. **SQLite database** — file on Docker volume (`/app/data/bot.db`)

No Telegram dependency. No email service.

### Data Flow

```
User → elvishka.com (Cloudflare proxy, HTTPS)
  → Hetzner VM :3000 (HTTP)
    → Fastify: static React SPA (client/dist/) + REST API ← SQLite
```

### What Changes From Telegram Version

- Remove: node-telegram-bot-api, src/bot.js, Telegram initData auth
- Add: bcrypt, jsonwebtoken, React + Vite frontend
- Modify: users table (autoincrement ID + username/password instead of Telegram ID), auth middleware (JWT cookie instead of initData), server.js (new auth routes + card creation endpoint)

## Database Schema

### users
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK AUTOINCREMENT | User ID |
| username | TEXT UNIQUE NOT NULL | 3-30 chars, alphanumeric + underscore |
| password | TEXT NOT NULL | bcrypt hash |
| created_at | DATETIME | Registration time |

### sets
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK AUTOINCREMENT | Set ID |
| user_id | INTEGER FK → users.id | Owner |
| title | TEXT NOT NULL | Set title |
| share_code | TEXT UNIQUE | 6-char code, generated on first share |
| created_at | DATETIME | Creation time |

### cards
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK AUTOINCREMENT | Card ID |
| set_id | INTEGER FK → sets.id ON DELETE CASCADE | Parent set |
| word | TEXT NOT NULL | The word/term |
| translations | TEXT NOT NULL | JSON array: `["t1","t2"]` |

### progress
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK AUTOINCREMENT | Progress ID |
| user_id | INTEGER FK → users.id | User (UNIQUE with card_id) |
| card_id | INTEGER FK → cards.id ON DELETE CASCADE | Card (UNIQUE with user_id) |
| status | TEXT | `"new"` / `"learning"` / `"known"` |
| last_seen | DATETIME | Last interaction time |
| mistakes | INTEGER DEFAULT 0 | Mistake counter |

### Progress Logic

- New cards start with status `new`
- Correct answer → `known`
- Wrong answer → `learning`, `mistakes` counter increments
- Card order in tests: `learning` first, then `new`, then `known`
- Sharing copies sets and cards but NOT progress

## Auth API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | `{username, password}` → create user, set JWT cookie |
| POST | `/api/auth/login` | `{username, password}` → verify, set JWT cookie |
| POST | `/api/auth/logout` | Clear cookie |
| GET | `/api/auth/me` | Return current user or 401 |

- Password: minimum 6 characters, hashed with bcrypt (salt rounds: 10)
- Username: 3-30 characters, `/^[a-zA-Z0-9_]+$/`
- JWT: signed with `JWT_SECRET` env var, stored in httpOnly cookie, 30-day expiry
- All `/api/*` routes except auth endpoints require valid JWT

## Data API

All endpoints require valid JWT cookie. User ID extracted from JWT.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sets` | List user's sets (id, title, card_count, progress summary) |
| POST | `/api/sets` | Create set `{title, cards: [{word, translations}]}` |
| GET | `/api/sets/:id` | Set with all cards and progress |
| DELETE | `/api/sets/:id` | Delete own set |
| POST | `/api/sets/:id/cards` | Add single card `{word, translations}` |
| POST | `/api/sets/:id/share` | Generate share code, return it |
| POST | `/api/share/:code` | Import set by share code |
| POST | `/api/progress` | Update card progress `{cardId, status}` |

## React Frontend

SPA with React Router. 5 screens.

### Auth Screens (`/login`, `/register`)

- Two fields: username, password
- Submit button
- Link to switch between login/register
- Validation: username 3-30 alphanumeric, password 6+ chars
- On success: redirect to `/`
- On error: show message below form

### Set List (`/`)

- Protected route (redirect to `/login` if not authenticated)
- Grid/list of set cards showing: title, card count, progress bar
- "New Set" button → creates empty set and navigates to `/sets/:id`
- "Import by Code" button → modal with code input
- Logout button in header

### Set Detail (`/sets/:id`)

- Title (editable inline or header)
- Progress bar: known (green) / learning (orange) / new (gray)
- Stats: `X known · Y learning · Z new · N total`

**Add words — two modes:**

1. **Single**: two inputs (word + translations) + "Add" button. Translations comma-separated.
2. **Bulk**: textarea with format `word - t1, t2` (one per line). Real-time validation:
   - Valid lines: green left border
   - Invalid lines (no ` - ` separator): red left border + tooltip "Expected format: word - translation1, translation2"
   - "Add All" button, disabled if any line is invalid
   - Empty lines are ignored

- Word list: scrollable, each item shows word + translations + delete button
- Direction toggle: "Word → Translation" / "Translation → Word"
- Action buttons: "Cards" (flashcard mode), "Test" (multiple choice)
- "Share" button → shows/hides share code

### Flashcard Mode (`/sets/:id/flashcard`)

- Card centered, shows word (or translation based on direction)
- Click/tap to flip with CSS 3D animation
- Two buttons: "Don't know" (red) → `learning`, "Know" (green) → `known`
- Card order: `learning` → `new` → `known`
- Counter: `3 / 15`
- End screen: summary (knew X, didn't know Y), "Try Again" button, "Back to Set" button

### Test Mode (`/sets/:id/test`)

- Shows word + 4 answer options (1 correct + 3 random from same set)
- If set has < 4 cards: show all available options
- Correct answer highlights green; wrong highlights red + shows correct
- "Next" button after answering
- Counter, end screen with score

## Project Structure

```
client/                    — React SPA (Vite)
  src/
    main.jsx               — entry point, router
    api.js                 — fetch wrapper (credentials: 'include')
    components/
      AuthForm.jsx         — login/register form
      SetCard.jsx          — set preview card for list
      WordList.jsx         — word list with delete
      BulkInput.jsx        — textarea with validation
      Flashcard.jsx        — flip card component
      TestQuestion.jsx     — multiple choice question
      ProgressBar.jsx      — known/learning/new bar
    pages/
      LoginPage.jsx
      RegisterPage.jsx
      SetsPage.jsx         — set list (home)
      SetDetailPage.jsx    — set view + add words
      FlashcardPage.jsx    — flashcard study mode
      TestPage.jsx         — multiple choice test mode
    context/
      AuthContext.jsx       — auth state, login/logout/register functions
  index.html
  vite.config.js           — proxy /api to localhost:3000 in dev
src/                       — Backend
  index.js                 — entry point
  db.js                    — SQLite setup, migrations, queries
  auth.js                  — JWT sign/verify, bcrypt hash/compare, cookie middleware
  server.js                — Fastify: auth routes + data API + static serving
tests/
  db.test.js
  auth.test.js
  server.test.js
Dockerfile                 — multi-stage: build React, then production image
docker-compose.yml         — local dev
docker-compose.prod.yml    — production (image from ghcr.io)
.github/workflows/deploy.yml — CI: test → build → push → SSH deploy
.env.example
package.json
```

## Docker

### Multi-stage Dockerfile

```
Stage 1 (build): node:20-alpine
  - cd client && npm ci && npm run build → client/dist/

Stage 2 (production): node:20-alpine
  - npm ci --production (server deps only)
  - Copy src/ + client/dist/
  - EXPOSE 3000, VOLUME /app/data
  - CMD ["node", "src/index.js"]
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| JWT_SECRET | Secret for signing JWT tokens |
| DATA_DIR | Path to SQLite file directory (default: ./data) |
| PORT | Server port (default: 3000) |

### CI/CD (GitHub Actions)

Same pipeline as before:
1. **test** — `npm ci && npm test`
2. **build-and-push** — Docker build, push to ghcr.io
3. **deploy** — SSH to VM, pull image, `docker compose up -d`

GitHub Secrets:
- `VM_HOST` — 188.245.72.139
- `VM_USER` — SSH user
- `VM_SSH_KEY` — private SSH key
- `JWT_SECRET` — JWT signing secret

### Cloudflare Setup

- A record: `elvishka.com → 188.245.72.139` (proxied, orange cloud)
- SSL/TLS mode: Flexible (Cloudflare terminates HTTPS, connects to VM via HTTP)
- No origin certificate needed on VM
