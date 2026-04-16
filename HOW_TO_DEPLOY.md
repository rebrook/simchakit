# How to Deploy SimchaKit
### Plain-English Step-by-Step Guide

---

## Before You Start — What You're Actually Doing

Think of it like baking a cake:

- **The source files** (`App.jsx`, tab components, etc.) are the **recipe and raw ingredients**
- **Running the build** is **baking the cake** — Vite reads all the source files and produces a finished, optimized version
- **Deploying** is **putting the cake on the table** — the deploy script copies the finished output into the right folders automatically

You only need to do the first-time setup once. After that, every future deployment is
a single command.

---

## What You Need Before You Start

- A server running Node.js v18, v20, or v22 (see Step 2 for how to check)
- Terminal (command line) access to that server — via SSH or directly
- The SimchaKit source files (downloaded from GitHub):
  - `client/package.json`
  - `client/vite.config.js`
  - `client/index.html`
  - `client/src/main.jsx`
  - `client/src/App.jsx`
  - `client/src/App.css`
  - `client/src/components/` ← all tab and shared component files
  - `client/src/constants/` ← shared constant definitions
  - `client/src/utils/` ← utility functions
  - `client/src/hooks/` ← custom React hooks
  - `public/index.html` ← the events picker page
  - `deploy.sh` ← the deploy script
  - `server.js`
  - `src/router.js`
  - `src/state.js`
  - `src/ws.js`
  - `changelog.json`
  - `DEPLOY.md`
  - `HOW_TO_DEPLOY.md`

---

## A Note on Event IDs

Every event in SimchaKit has a unique **event ID** — a short, URL-friendly name you
choose when setting up the event. It becomes part of the URL and the folder name on disk.

**Examples:**
- `smith-wedding-2026`
- `cohen-bar-mitzvah-2027`
- `johnson-graduation-2025`

**Rules:**
- Lowercase letters, numbers, and hyphens only
- No spaces or special characters
- Keep it short and descriptive

The app automatically reads the event ID from the URL at runtime — there is nothing
to configure in the code. Create the folder, copy `index.html` once, and the app
connects to the right data automatically.

Throughout this guide, replace `your-event-id` with the event ID you chose, and
replace `/path/to/simchakit` with the actual folder where you installed SimchaKit
on your server.

---

## Part 1 — Place the Files on Your Server

Copy the SimchaKit files into a folder on your server. Use whatever method works
for your setup — SCP, SFTP, rsync, or a file manager. The exact location is up to you:

- Linux server: `/var/www/simchakit/` or `/home/your-username/simchakit/`
- macOS: `/usr/local/var/simchakit/` or any folder you prefer
- Any path works — SimchaKit doesn't require a specific location

After copying, the folder should look like this:

```
simchakit/
│
├── client/                          ← Vite source — never served to users
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── App.css
│       ├── components/
│       │   ├── shared/
│       │   └── tabs/
│       ├── constants/
│       ├── utils/
│       └── hooks/
│
├── public/
│   └── index.html                   ← Events picker page
│
├── src/
│   ├── router.js
│   ├── state.js
│   └── ws.js
│
├── server.js
├── deploy.sh                        ← Deploy script
├── changelog.json
├── DEPLOY.md
└── HOW_TO_DEPLOY.md
```

> **The `public/` folder is what gets served to users.**
> The `client/` folder is source code — it is never served directly.

---

## Part 2 — Open a Terminal on Your Server

You need a terminal (command line) to run the setup and deploy commands.

**If your server is a remote machine (most common):**
Connect via SSH from your computer. Open a terminal on your computer first:

- **Mac:** Open the **Terminal** app (Applications → Utilities → Terminal)
- **Windows:** Open **PowerShell** (search for it in the Start menu) or install
  [Windows Terminal](https://aka.ms/terminal) from the Microsoft Store
- **Linux:** Open your terminal emulator of choice

Then connect to your server:

```bash
ssh your-username@your-server-address
```

Replace `your-username` with your server login and `your-server-address` with your
server's IP address or hostname. For example:

```bash
ssh admin@192.168.1.100
ssh deploy@myserver.example.com
```

It will ask for your password. Type it and press Enter — you won't see the characters
as you type, that's normal.

The first time you connect you'll see:
```
Are you sure you want to continue connecting (yes/no)?
```
Type `yes` and press Enter. This only happens once per server.

When you see a prompt like `username@servername:~$` you're connected and ready.

**If your server is a local machine or you have direct access:**
Just open a terminal directly — no SSH needed.

---

## Part 3 — First-Time Setup (Run Once Ever)

Once you have a terminal, run these commands one at a time.

---

**Step 1 — Install server-side dependencies**

SimchaKit's server requires one npm package (`bcryptjs`) for picker password hashing.
Run this once in the root server folder:

```bash
cd /path/to/web
npm install
```

This installs `bcryptjs` alongside the existing `express` and `ws` packages.

---

**Step 2 — Navigate to the client folder**

```bash
cd /path/to/simchakit/client
```

Nothing visible happens — you've just moved into that folder.

---

**Step 3 — Confirm Node.js is available**

```bash
node --version
```

You should see something like `v20.18.0` or `v22.x.x`. Any version starting with 18,
20, or 22 is fine.

If you see `command not found`, Node.js is not installed or not in your PATH. Visit
[nodejs.org](https://nodejs.org) to download and install it, then try again.

---

**Step 4 — Install client dependencies**

```bash
npm install
```

This downloads React, Vite, and one plugin into a `node_modules/` folder.
Takes about 30–60 seconds the first time.

When it finishes you'll see something like:

```
added 62 packages, and audited 63 packages in 23s
```

You'll also see some extra messages — all are safe to ignore:

- **`X packages looking for funding`** — open-source donation requests, irrelevant
- **`moderate severity vulnerabilities`** — in Vite's dev tools only, not your app.
  Do **not** run `npm audit fix --force`
- **`New major version of npm available`** — ignore, no effect on this project

---

**Step 5 — Make the deploy script executable**

```bash
chmod +x /path/to/simchakit/deploy.sh
```

This is a one-time step. You do not need to edit `deploy.sh` before running it — the script locates itself automatically based on where it is placed. You can run it from anywhere — no need to `cd` first.

---

## Part 4 — Create Your First Event Folder

Before deploying, create a folder for your event and do a first build so the deploy
script has something to copy. Replace `your-event-id` with the event ID you chose:

**Step 6 — Run the first build**

```bash
cd /path/to/simchakit/client
npm run build
```

**Step 7 — Create the event folder and copy the initial index.html**

```bash
mkdir -p /path/to/simchakit/public/your-event-id

cp /path/to/simchakit/client/dist/index.html \
   /path/to/simchakit/public/your-event-id/index.html
```

You only do this once per event. After this, the deploy script handles everything
automatically — it detects every folder that has an `index.html` and updates it.

---

## Part 5 — Deploy (Every Future Release)

From this point on, every deployment is a single command. You can run it from
anywhere on your server:

```bash
bash /path/to/simchakit/deploy.sh
```

**What it does automatically:**
- Runs `npm run build`
- Cleans and replaces the shared `assets/` folder
- Updates `index.html` in every event folder automatically
- Prints a summary showing exactly what was deployed

**Example output:**

```
================================================
  SimchaKit Deploy
================================================

▶ Building...
  vite v5.x.x building for production...
  ✓ built in 14.23s

▶ Deploying assets...
  ✓ 2 file(s) in public/assets/
    index-BIvrzd2r.js
    index-CuLxlvID.css

▶ Deploying to event folders...
  ✓ smith-wedding-2026/index.html
  ✓ cohen-bar-mitzvah-2027/index.html

================================================
  Done — 2 event(s) updated
================================================
```

---

## Adding a New Event

Each new event is two commands — no config changes, no rebuild, no hardcoded IDs:

```bash
mkdir -p /path/to/simchakit/public/new-event-id

cp /path/to/simchakit/client/dist/index.html \
   /path/to/simchakit/public/new-event-id/index.html
```

The app automatically derives its board ID from the URL at runtime — no code change
needed. Navigate to `/simcha/new-event-id/` and the app connects to its own data
automatically.

After that first manual copy, every future `bash deploy.sh` run picks it up
automatically alongside all other events.

---

## Updating App.jsx, App.css, or Any Component File

SimchaKit's logic is split across many source files — `App.jsx` is the shell, and
each tab and modal lives in its own file under `client/src/components/tabs/`. When
you receive an update, you only need to copy the files that changed.

**Step 1 — Copy the updated file(s) to your server**

```bash
# App.jsx (most releases include this)
scp App.jsx your-username@your-server-address:/path/to/simchakit/client/src/App.jsx

# App.css (copy when styles changed)
scp App.css your-username@your-server-address:/path/to/simchakit/client/src/App.css

# A specific tab file (copy when that tab was updated)
scp GuestsTab.jsx your-username@your-server-address:/path/to/simchakit/client/src/components/tabs/GuestsTab.jsx
```

Copy every file that changed. The build step compiles everything in `client/src/`
together — if you skip a changed file, the build will use the old version still on disk.

**Step 2 — Run the deploy script**

```bash
bash /path/to/simchakit/deploy.sh
```

That's it. The script builds and deploys to all events in one step.

---

## Updating changelog.json

Drop it directly — no build, no restart:

```bash
scp changelog.json your-username@your-server-address:/path/to/simchakit/changelog.json
```

---

## Updating the Events Picker Page

The events picker (`public/index.html`) is plain HTML — no build needed.
Drop it directly:

```bash
scp index.html your-username@your-server-address:/path/to/simchakit/public/index.html
```

---

## What the Final Folder Structure Should Look Like

After a successful first deploy:

```
simchakit/
│
├── client/
│   ├── node_modules/                ← created by npm install
│   ├── dist/                        ← created by npm run build
│   │   ├── index.html
│   │   └── assets/
│   │       ├── index-[hash].js
│   │       └── index-[hash].css
│   └── src/ ...
│
├── public/
│   ├── index.html                   ← events picker
│   ├── assets/                      ← shared, managed by deploy script
│   │   ├── index-[hash].js
│   │   └── index-[hash].css
│   └── your-event-id/
│       └── index.html               ← managed by deploy script
│
├── data/
│   └── simcha-your-event-id.json    ← auto-created by server on first load
│
└── deploy.sh
```

---

## If Something Goes Wrong

**The app shows a blank page or 404 error:**

Run the deploy script again — it cleans and recreates the assets folder from scratch:

```bash
bash /path/to/simchakit/deploy.sh
```

If the problem persists, check the assets folder manually:

```bash
ls /path/to/simchakit/public/assets/
```

You should see exactly two files — one `.js` and one `.css`. If you see a nested
`assets/assets/` folder or stale filenames, delete the folder and re-run the script:

```bash
rm -rf /path/to/simchakit/public/assets/
bash /path/to/simchakit/deploy.sh
```

**The build fails with an error:**

The live site is unaffected — the script stops before touching `public/` if the
build fails. Copy the full error message and open a GitHub issue.

**`node: command not found`:**

Node.js is not installed or not in your PATH. Visit [nodejs.org](https://nodejs.org)
to install the current LTS version, then try again.

---

## What You Do NOT Need to Do

- You do **not** need to restart the server after running the deploy script
- You do **not** need to touch `router.js`, `state.js`, or `ws.js`
- You do **not** need to rebuild when updating `changelog.json` or the events picker
- You do **not** need to copy `node_modules/` or `dist/` anywhere
- You do **not** need to change `vite.config.js` when adding new events
- You do **not** need to manually copy assets or run `cp` commands for assets — the deploy script handles all of that
