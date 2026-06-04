# SimchaKit

A real-time event planning web app for celebrations — B'nei Mitzvot, weddings, and other simchas.

![Version](https://img.shields.io/badge/version-3.16.3-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Hosted Version

> **Looking for something more?** The hosted version of SimchaKit is always running the latest features and accessible from anywhere -- no server required. Visit [app.simcha-kit.com](https://app.simcha-kit.com) to learn more.

## Screenshots

### Overview Dashboard
![Overview Dashboard](docs/screenshots/overview.png)

### Guest Management
![Guest Management](docs/screenshots/guests.png)

### Seating Chart
![Seating Chart](docs/screenshots/seating.png)

### Admin Configuration
![Admin Configuration](docs/screenshots/admin.png)

## Features

- **Shared Access** — invite co-planners as Editors (full access) or Viewers (read-only), or a Ritual Coordinator (ceremony and prep only) for clergy or tutors; collaborators covered by the event owner's purchase
- **Guest Management** — households, people, formal names, dietary requirements, RSVP tracking
- **Sub-Event Support** — track attendance across multiple events (service, kiddush, reception)
- **Budget Tracking** — expenses, payments, vendor costs, gratuity calculator
- **Vendor Management** — contacts, contracts, payment schedules
- **Task Lists** — categorized to-dos with due dates and completion tracking
- **Seating Charts** — table management with drag-and-drop assignment
- **Gift Tracking** — record gifts and track thank-you notes
- **Favor Management** — track sweatshirts, kippot, or other party favors by size
- **Day-Of Mode** — streamlined mobile view for event day with hot sheet and vendor contacts
- **Real-Time Sync** — WebSocket-based updates across all connected devices (V2) / fetch-on-navigate (V3)
- **Theming** — customizable color palettes and event branding
- **Print Brief** — generate a comprehensive event summary document
- **CSV Import/Export** — import guest lists, export for invitation vendors
- **Admin Mode** — sidebar navigation groups settings into Event Setup, People & Logistics, and App Config; password-protected, owner-only access; changes save immediately
- **Backup & Restore** — export a full JSON backup and restore from any previous backup via Admin Mode → Data

## Tech Stack

### V3 — SimchaKit Platform (SaaS, hosted at app.simcha-kit.com)

- **Frontend**: Vite + React 18
- **Auth**: Supabase magic link (passwordless email)
- **Database**: Supabase (Postgres + Row Level Security)
- **Hosting**: Vercel (frontend + serverless API functions)
- **Payments**: Stripe (one-time fee per event)
- **Styling**: Custom CSS with CSS variables for theming

### V2 — Self-Hosted NAS Edition

- **Frontend**: Vite + React 18
- **Backend**: Node.js + Express + WebSocket
- **Data**: JSON file storage (per-event)
- **Styling**: Custom CSS with CSS variables for theming

## Quick Start

### V3 — SimchaKit Platform

Visit [app.simcha-kit.com](https://app.simcha-kit.com), sign in with your email, and create your first event. Learn more at [about.simcha-kit.com](https://about.simcha-kit.com).

### V2 — Self-Hosted

#### Prerequisites

- Node.js v18, v20, or v22
- npm v8+

#### Installation

```bash
# Clone the repository
git clone https://github.com/rebrook/simchakit.git
cd simchakit

# Install server dependencies
npm install

# Install client dependencies
cd client
npm install

# Build the client
npm run build
cd ..

# Start the server
node server.js
```

The app will be available at `http://localhost:3000/simcha/`

#### Creating Your First Event

1. Navigate to `http://localhost:3000/simcha/` — this opens the Event Picker
2. Click the **+ New Event** button
3. Enter an Event ID (e.g., `smith-wedding-2026`) — lowercase letters, numbers, and hyphens only
4. Click **Create**

You'll be taken to your new event dashboard. From there, open the **Admin** panel to configure:
- Event name and type (Bat Mitzvah, Wedding, etc.)
- Theme and color palette
- Timeline with sub-events (service, reception, etc.)
- Clergy and venue contacts

## Documentation

- **[DEPLOY.md](DEPLOY.md)** — Technical deployment reference
- **[HOW_TO_DEPLOY.md](HOW_TO_DEPLOY.md)** — Plain-English step-by-step guide

## Project Structure

```
simchakit/
├── client/                  # Vite + React frontend (shared build tooling)
│   ├── public/              # Static assets (favicon, changelog.json)
│   ├── index.html           # V2 Vite HTML entry
│   ├── index.v3.html        # V3 Vite HTML entry
│   ├── vite.config.js       # V2 build config (base: /simcha/, src/ alias)
│   ├── vite.config.v3.js    # V3 build config (base: /, src-v3/ alias)
│   ├── api/                 # Vercel serverless functions (V3 only)
│   │   ├── notify.js
│   │   ├── brevo-sync.js
│   │   ├── accept-invite.js
│   │   ├── send-invite.js
│   │   ├── validate-coupon.js
│   │   ├── create-checkout-session.js
│   │   └── stripe-webhook.js
│   ├── src/                 # V2 source — never modified for V3 work
│   │   ├── components/      # Tab and modal components
│   │   ├── constants/       # Shared constants
│   │   ├── hooks/           # Custom React hooks
│   │   └── utils/           # Utility functions
│   └── src-v3/              # V3 source — never modified for V2 work
│       ├── App.v3.jsx       # V3 auth-aware root
│       ├── App.css          # Shared stylesheet
│       ├── main.v3.jsx      # V3 React entry point
│       ├── components/      # V3 components (shell, tabs, events, auth)
│       ├── constants/       # V3 constants
│       ├── hooks/           # V3 hooks (useEventData, useDarkMode)
│       ├── lib/             # Supabase client
│       └── utils/           # V3 utilities
├── src/                     # V2 Express server modules
│   ├── router.js            # API routes
│   ├── state.js             # State management
│   └── ws.js                # WebSocket handler
├── public/                  # V2 served files: Event Picker + per-event folders
│   ├── index.html           # V2 Event Picker
│   ├── favicon.svg          # Favicon
│   ├── assets/              # Built JS/CSS bundles (shared)
│   └── {event-id}/          # Per-event folders
│       └── index.html       # V2 event dashboard entry point
├── server.js                # V2 Express entry point
├── deploy.sh                # V2 build and deploy script
├── vercel.json              # V3 Vercel build + API routing config
└── changelog.json           # Version history (V2.x and V3.x)
```

## Deployment

### V3 — Vercel + Supabase

#### Application (Vercel)

Push to the `main` branch. Vercel automatically builds and deploys from `client/` using `vite.config.v3.js`. Serverless functions in `client/api/` are deployed alongside the frontend.

Files that require a deploy when changed:
- Any file under `client/src-v3/`
- Any file under `client/api/`
- `client/public/changelog.json`
- `vercel.json`

#### Database (Supabase)

Schema changes (new tables, RLS policies, functions) are applied directly in the Supabase SQL editor. There is no ORM or migration runner -- SQL is written, reviewed, and pasted into the editor manually.

**Standard process for a database change:**
1. Write and review the SQL locally (in outputs)
2. Open the Supabase dashboard → SQL Editor
3. Paste the full migration block and run it
4. Run smoke test queries to verify the change took effect
5. No Vercel deploy is needed for database-only changes

**Critical rules:**
- Any function referenced inside an RLS policy must have `EXECUTE` granted to `anon` -- even if anon never calls it directly. Failure surfaces as a table access error, not a function error.
- `CREATE OR REPLACE FUNCTION` does not preserve existing grants. Always re-run `GRANT EXECUTE` after replacing a function.
- The demo event (UUID `440a8b9e-e92e-4ad6-b352-41965bd8383b`) has hardcoded `anon` policies on every collection table. New tables must include matching Demo read and Demo write policies if they need to be accessible from `demo.simcha-kit.com`.

#### Changelog

`changelog.json` lives in two places and both must be updated on every version bump:
- `changelog.json` (repo root)
- `client/public/changelog.json` (served as a static asset)

Always edit using Python `json.load` / `json.dump` -- never string replacement. Verify `current` matches the first entry version before committing.

### V2 — Self-Hosted NAS

SimchaKit V2 is designed to run on any server with Node.js -- a VPS, home server, NAS, or local machine.

**Standard deploy process:**
1. Copy changed source files to the NAS via SMB (Mac Finder → `brooknas.familyds.net`)
2. SSH into the NAS
3. `cd /volume1/web/simchakit`
4. `bash deploy.sh` -- builds the client and restarts as needed

**Server restart required** when any of these files change: `src/router.js`, `src/state.js`, `src/ws.js`. All other file changes (React components, CSS, constants) take effect after `deploy.sh` without a restart.

See [HOW_TO_DEPLOY.md](HOW_TO_DEPLOY.md) for detailed instructions.

## Development

### V3

```bash
cd client
npm run dev  # Vite dev server at http://localhost:5173/
```

### V2

```bash
# Start the Express server (terminal 1)
node server.js

# Start Vite dev server with hot reload (terminal 2)
cd client
npm run dev
```

The V2 dev server runs at `http://localhost:5173/simcha/` with API calls proxied to the Express server.

## License

MIT License — see [LICENSE](LICENSE) for details.

## Author

Brook Creative LLC
