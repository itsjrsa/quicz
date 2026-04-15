# Quicz

## Description

Quicz is a lean, self-hostable live quiz application for training sessions and workshops. Inspired by Mentimeter, it supports admin-controlled quiz flow with real-time audience participation, live result display, and scoring.

Participants join via a 6-character session code on any device. The admin controls the session flow — opening voting, locking responses, revealing results, and showing the final scoreboard — from a presenter control panel.

## Project Status

🚧 **In Development** — Core functionality implemented. See [Known Issues](#known-issues).

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Database | SQLite via `better-sqlite3` |
| ORM | Drizzle ORM |
| Realtime | Socket.IO 4 |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Runtime | Node.js 20+ |

## Dependencies

- Node.js 20+
- npm 9+
- (Optional) Docker + Docker Compose for containerized deployment

## Installation

### Local Development

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd quicz
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment file and set your values:
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   ```
   ADMIN_PASSWORD=your-secure-password
   SESSION_SECRET=your-long-random-secret
   DATABASE_URL=./data/quicz.db
   PORT=3000
   ```

4. Run migrations:
   ```bash
   npm run db:migrate
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

### Docker

```bash
cp .env.example .env
# Edit .env with your values
docker compose up -d
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Usage

### Admin

1. Go to `/admin` and log in with your `ADMIN_PASSWORD`
2. Create a quiz under **Quizzes → New Quiz**
3. Add questions (single choice, multiple choice, or binary) with correct answers marked
4. Click **Start Session** to create a live session
5. Share the 6-character session code with participants
6. Control the session from the **Presenter** panel:
   - **Start Quiz** — move from lobby to first question
   - **Lock Voting** — stop accepting answers
   - **Show Results** — display answer distribution
   - **Reveal Answer** — show correct answer + personal result to participants
   - **Next Question** — advance to the next question
   - **Show Final Scoreboard** — display rankings
7. View full results and export to CSV from the **Results** page

### Participants

1. Go to `/join` (or the root URL)
2. Enter the 6-character session code
3. Enter a display name
4. Answer questions as they appear
5. See your result after each question and your final rank

## Architecture Diagrams

Architecture diagrams are located in `docs/diagrams/` (to be added).

The app runs as a single process: a custom Node.js HTTP server that wraps Next.js and attaches a Socket.IO server. All realtime events and HTTP requests share the same port.

```
Browser → HTTP/WebSocket → Node.js server (server.ts)
                              ├── Next.js App Router (pages, API routes)
                              └── Socket.IO (realtime session events)
                                       └── SQLite (better-sqlite3 / Drizzle ORM)
```

## Known Issues

- No reconnection handling if the server restarts mid-session (session state is in SQLite, but Socket.IO room membership is lost)
- No rate limiting on join or answer submission endpoints
- No pagination on quiz list or session history

## Credits

Built with [Next.js](https://nextjs.org/), [Drizzle ORM](https://orm.drizzle.team/), [Socket.IO](https://socket.io/), and [Recharts](https://recharts.org/).

## Contacts

Maintained by the INESCTEC team. For issues, open a GitHub issue.
