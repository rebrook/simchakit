# SimchaKit — Build & Deployment Reference

> Applies from **V2.0.0** onward.
> Before V2.0.0, the app was a single `index.html` file using Babel standalone — no build step required.
> From V2.0.0 onward, the app is built with Vite. All deployments are handled by `deploy.sh`.

---

## Folder Structure

```
simchakit/
│
├── client/                          ← Vite source — never served to users
│   ├── package.json                 ← npm dependencies
│   ├── vite.config.js               ← build config (base: "/simcha/")
│   ├── index.html                   ← Vite entry shell (not the deployed file)
│   ├── node_modules/                ← installed by npm install (never deploy this)
│   ├── dist/                        ← build output (managed by deploy.sh)
│   │   ├── index.html
│   │   └── assets/
│   │       ├── index-[hash].js
│   │       └── index-[hash].css
│   └── src/
│       ├── main.jsx                 ← React boot entry point
│       ├── App.jsx                  ← App shell (imports, EVENT_ID, App() function)
│       ├── App.css                  ← All CSS
│       ├── components/
│       │   ├── shared/              ← Reusable components (ThemeProvider, ArchivedNotice, etc.)
│       │   └── tabs/                ← One file per tab/modal group
│       │       ├── OverviewTab.jsx
│       │       ├── GuestsTab.jsx    ← includes HouseholdModal, ImportModal, TimelineEntryModal
│       │       ├── BudgetTab.jsx    ← includes GratuityCalculator, ExpenseModal
│       │       ├── VendorsTab.jsx
│       │       ├── TasksTab.jsx
│       │       ├── PrepTab.jsx
│       │       ├── SeatingTab.jsx
│       │       ├── GiftsTab.jsx
│       │       ├── FavorsTab.jsx
│       │       ├── CalendarTab.jsx
│       │       ├── AccommodationsTab.jsx
│       │       ├── SearchOverlay.jsx
│       │       ├── AdminPanel.jsx   ← includes AdminLogin
│       │       ├── DayOfOverlay.jsx ← includes DayOfItemModal
│       │       └── Modals.jsx       ← GuideModal, ActivityLogModal, WhatsNewModal
│       ├── constants/               ← Shared constant definitions
│       ├── utils/                   ← Pure utility functions
│       └── hooks/                   ← Custom React hooks
│
├── public/                          ← Served to users at /simcha/
│   ├── index.html                   ← Events picker (plain HTML, drop directly)
│   ├── assets/                      ← Shared JS + CSS (managed by deploy.sh)
│   │   ├── index-[hash].js
│   │   └── index-[hash].css
│   └── your-event-id/               ← One subfolder per event
│       └── index.html               ← Managed by deploy.sh after first-time setup
│
├── src/                             ← Express server files
│   ├── router.js                    ← API routes and static file serving
│   ├── state.js                     ← In-memory + disk state management
│   └── ws.js                        ← WebSocket handler
│
├── server.js                        ← Express entry point
├── deploy.sh                        ← Deploy script — the only deploy tool you need
│
├── data/                            ← Per-event state files (auto-created by server)
│   └── simcha-your-event-id.json
│
├── picker-config.json               ← Auto-created on first picker request (hashed password)
│                                       Listed in .gitignore — never commit this file
├── .gitignore                       ← Excludes node_modules/, data/, picker-config.json
├── changelog.json                   ← Drop directly — no build needed
├── DEPLOY.md                        ← This file
└── HOW_TO_DEPLOY.md                 ← Plain-English step-by-step guide
```

---

## Server Requirements

| Requirement | Minimum | Recommended |
|---|---|---|
| Node.js | v18 | v20 LTS or v22 |
| npm | v8 | v10 |
| OS | Any (Linux, macOS, Windows) | Linux or macOS |
| Disk space | ~50 MB for node_modules | 100 MB+ |

SimchaKit runs on any server that can run Node.js — a VPS, a home server, a NAS,
or a local machine. It does not require a cloud provider or specific hosting platform.

---

## How the Asset Path Works

The Express server mounts `public/` at the `/simcha/` URL path:

```js
// server.js
app.use("/simcha", express.static(path.join(__dirname, "simchakit", "public")));
```

`vite.config.js` sets `base: "/simcha/"`, which tells Vite to prefix all asset paths
with `/simcha/` in the built `index.html`. This means:

- Assets at `client/dist/assets/` → deployed to `public/assets/` → served at `/simcha/assets/`
- Every event's `index.html` references the same `/simcha/assets/` path regardless of
  which subfolder it lives in

This is why all events share one `assets/` folder and adding a new event requires
copying only one file.

> **If you mount SimchaKit at a different URL path** (e.g. `/events/` instead of `/simcha/`),
> update `base` in `vite.config.js` to match before building.

---

## First-Time Setup (Run Once Ever)

```bash
# 1. Install server-side dependencies (bcryptjs for picker password hashing)
cd /path/to/web
npm install

# 2. Install client dependencies
cd /path/to/simchakit/client
node --version     # Must show v18, v20, or v22
npm install

# 3. Make the deploy script executable
chmod +x /path/to/simchakit/deploy.sh
```

---

## The Deploy Script

`deploy.sh` is the only tool you need for all deployments. Run it from anywhere:

```bash
bash /path/to/simchakit/deploy.sh
```

**What it does:**
1. Runs `npm run build` inside `client/`
2. Deletes and recreates `public/assets/` cleanly — no stale files, no nesting
3. Copies `dist/index.html` into every event folder that already contains an `index.html`
4. Prints a verification summary

**What it does NOT touch:**
- `server.js` or any server files
- `changelog.json`
- `public/index.html` (events picker)
- Any folder in `public/` that doesn't already have an `index.html`

---

## Every Release — Full Deploy Sequence

```bash
# 1. Copy updated source files to the server (from your computer)
#    App.jsx is the most common change — copy it plus any updated tab files
scp App.jsx your-username@your-server:/path/to/simchakit/client/src/App.jsx

#    If a tab or shared component was updated, copy it too. Example:
scp GuestsTab.jsx your-username@your-server:/path/to/simchakit/client/src/components/tabs/GuestsTab.jsx

# 2. Run the deploy script (on the server) — handles everything else
bash /path/to/simchakit/deploy.sh

# 3. Drop changelog.json directly (from your computer, no build needed)
scp changelog.json your-username@your-server:/path/to/simchakit/changelog.json
```

> **Any file under `client/src/` that changed needs to be copied before running the deploy script.**
> The build step compiles everything in `client/src/` together — if you forget a file,
> the build will use the old version still on disk.

---

## Adding a New Event

```bash
# 1. Create the event folder and do the first-time copy
mkdir -p /path/to/simchakit/public/new-event-id
cp /path/to/simchakit/client/dist/index.html \
   /path/to/simchakit/public/new-event-id/index.html
```

No config changes. No rebuild. No hardcoded IDs. No server restart.
The app derives its board ID from the URL at runtime — navigate to
`/simcha/new-event-id/` and it connects to its own data automatically.
Every future `deploy.sh` run updates this event automatically alongside all others.
The server auto-creates `data/simcha-new-event-id.json` on first browser load.

---

## Updating the Events Picker Page

Plain HTML — no build step. Drop it directly:

```bash
scp index.html your-username@your-server:/path/to/simchakit/public/index.html
```

---

## Updating changelog.json

No build step. Drop it directly:

```bash
scp changelog.json your-username@your-server:/path/to/simchakit/changelog.json
```

---

## Starting the Server

```bash
cd /path/to/simchakit
node server.js
```

For production use, run the server with a process manager so it restarts automatically
on failure or reboot. [PM2](https://pm2.keymetrics.io/) is a common choice:

```bash
npm install -g pm2
pm2 start server.js --name simchakit
pm2 save
pm2 startup   # follow the printed instructions to enable auto-start on reboot
```

---

## Local Development

```bash
cd /path/to/simchakit/client
npm run dev
```

- Vite serves the app at `http://localhost:5173/simcha/`
- API and WebSocket calls proxy to the Express server at `http://localhost:3000`
  (configured in `vite.config.js` → `server.proxy`)
- The Express server must be running (`node server.js`) for data to load

---

## Rollback

Pre-V2.0.0 `index.html` files (Babel standalone) are fully self-contained — no build
step required. To roll back, copy the old `index.html` directly into the event subfolder.
No server restart needed.

---

## What Requires a Rebuild vs. What Doesn't

| Change | Action needed |
|---|---|
| Any `.jsx` or `.css` file under `client/src/` | Copy file to server → `bash deploy.sh` |
| `router.js`, `state.js`, `ws.js` | Restart server only — no rebuild |
| `server.js` | Restart server only — no rebuild |
| `changelog.json` | Drop file directly — no rebuild, no restart |
| `public/index.html` (events picker) | Drop file directly — no rebuild, no restart |
| `.gitignore` | Drop file directly — no rebuild, no restart |
| `picker-config.json` | Auto-created by server — do not deploy manually |
| Adding a new event | `mkdir` + copy `index.html` once, then `deploy.sh` forever after |
| Event data (via Admin Mode in browser) | Nothing — stored automatically in `data/` |

---

## npm install Output — What's Normal

| Message | Meaning | Action |
|---|---|---|
| `X packages looking for funding` | Open-source donation requests | Ignore |
| `moderate severity vulnerabilities` | In Vite dev tools only, not in deployed app | Ignore — do NOT run `npm audit fix --force` |
| `New major version of npm available` | npm itself has an update | Ignore — no effect on this project |

---

## Build Output Notes

- Vite produces one JS file and one CSS file per build, each named with a content hash
  (e.g. `index-BIvrzd2r.js`). The hash changes every build, automatically busting
  browser caches on deploy.
- `deploy.sh` deletes `public/assets/` before copying — this prevents stale files and
  nested folder issues.
- `base: "/simcha/"` in `vite.config.js` must match the path where the server mounts
  `public/`. If you change the mount path, update `base` to match and rebuild.
- Build time: approximately 10–30 seconds depending on server hardware.
