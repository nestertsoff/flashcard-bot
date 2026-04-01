# Telegram Flashcard Bot — Design Spec

## Overview

A Telegram bot with an HTML5 Mini App for creating and studying vocabulary flashcard sets (similar to Quizlet). Users send word lists via chat messages; the bot parses and stores them. Users study via an in-Telegram Mini App with two modes: flashcard flip and multiple-choice test.

## Stack

- **Runtime**: Node.js 20
- **Bot library**: node-telegram-bot-api
- **HTTP server**: Fastify (serves REST API + static Mini App)
- **Database**: SQLite via better-sqlite3
- **Frontend**: Vanilla HTML5/JS/CSS (Telegram Mini App)
- **Deployment**: Single Docker container, docker-compose

## Architecture

Single Docker container with three components:

1. **Telegram Bot** — receives messages, parses card sets, handles commands
2. **Fastify HTTP server** — serves Mini App static files and REST API
3. **SQLite database** — file on a Docker volume (`/app/data/bot.db`)

### Data Flow

```
User → Telegram message → Bot parses → API saves to SQLite
User → "Learn" button → Telegram opens Mini App → Mini App ← REST API ← SQLite
User → /share → Bot generates code → Other user → /share code → set copied
```

Mini App authenticates via `Telegram.WebApp.initData`. Server validates HMAC signature using bot token, extracts `user.id`.

## Database Schema

### users
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Telegram user ID |
| username | TEXT | Telegram username |
| created_at | DATETIME | Registration time |

### sets
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| user_id | INTEGER FK → users.id | Owner |
| title | TEXT | Set title |
| share_code | TEXT UNIQUE | 6-char code, generated on first share |
| created_at | DATETIME | Creation time |

### cards
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| set_id | INTEGER FK → sets.id | Parent set |
| word | TEXT | The word/term |
| translations | TEXT | JSON array: `["t1","t2"]` |

### progress
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| user_id | INTEGER FK → users.id | User (UNIQUE with card_id) |
| card_id | INTEGER FK → cards.id | Card (UNIQUE with user_id) |
| status | TEXT | `"new"` / `"learning"` / `"known"` |
| last_seen | DATETIME | Last interaction time |
| mistakes | INTEGER | Mistake counter, default 0 |

### Progress Logic

- New cards start with status `new`
- Correct answer → `known`
- Wrong answer → `learning`, `mistakes` counter increments
- Card order in tests: `learning` first, then `new`, then `known`
- Sharing copies sets and cards but NOT progress

## Telegram Bot

### Commands

- `/start` — welcome message + format instructions
- `/sets` — list user's sets as inline buttons, each opens Mini App
- `/share <code>` — import another user's set by share code

### Message Parsing

Any non-command text message is treated as a new set:

```
German Animals
Hund - собака, пёс
Katze - кошка
Vogel - птица
```

- Line 1: set title
- Remaining lines: `word - translation1, translation2`
- Word/translation separator: ` - ` (space-dash-space)
- Translation separator: `, ` (comma-space)
- Empty lines are ignored
- If parsing fails (no ` - ` found), bot replies with format hint

### Response After Creation

> Set "German Animals" created (3 cards)
> [Learn] — inline WebApp button opening Mini App with `?setId=123`

## REST API

All requests include `X-Telegram-Init-Data` header. Server validates HMAC signature via bot token and extracts `user.id`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sets` | List user's sets |
| GET | `/api/sets/:id` | Set with cards and progress |
| DELETE | `/api/sets/:id` | Delete a set |
| POST | `/api/sets/:id/share` | Generate share code, return it |
| POST | `/api/progress` | Update card progress `{cardId, status}` |

Static files served at `/app/*`.

## Mini App (HTML5)

Single-page application, vanilla JS/CSS, no frameworks.

### Set Screen

- Title, card count, progress summary (known / learning / new)
- Direction toggle: "Word → Translation" / "Translation → Word"
- Two buttons: "Cards" (flashcard mode) and "Test" (multiple choice)
- "Share" button — displays share code
- Full word list (scrollable)

### Flashcard Mode

- Card centered on screen, shows word (or translation based on direction)
- Tap to flip with CSS animation, reveals the answer
- Two buttons: "Don't know" (red) → status `learning` and "Know" (green) → status `known`
- Card order: `learning` → `new` → `known`
- End screen: summary of results (knew X, didn't know Y)

### Test Mode (Multiple Choice)

- Shows word + 4 answer options (1 correct + 3 random from same set)
- If set has < 4 cards, show all available options
- Correct answer highlights green; wrong highlights red + shows correct
- Updates progress same as flashcard mode
- End screen: score X/Y correct

### Navigation

- Telegram WebApp `BackButton` for navigation
- `Telegram.WebApp.MainButton` for primary actions where appropriate

## Docker

### Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
VOLUME /app/data
CMD ["node", "src/index.js"]
```

### docker-compose.yml

```yaml
services:
  bot:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - bot-data:/app/data
    environment:
      - BOT_TOKEN=${BOT_TOKEN}
      - WEBAPP_URL=${WEBAPP_URL}
volumes:
  bot-data:
```

### Environment Variables

- `BOT_TOKEN` — Telegram bot token from @BotFather
- `WEBAPP_URL` — Public HTTPS URL for the Mini App (e.g., ngrok for local dev)

SQLite database stored at `/app/data/bot.db` on a Docker volume (persists across restarts).

## Project Structure

```
src/
  index.js          — entry point, starts bot + server
  bot.js            — Telegram bot logic, message parsing
  server.js         — Fastify server, API routes
  db.js             — SQLite setup, migrations, queries
  auth.js           — Telegram initData validation
public/
  index.html        — Mini App entry point
  app.js            — Mini App logic
  style.css         — Mini App styles
Dockerfile
docker-compose.yml
package.json
.env.example
```
