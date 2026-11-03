# Agent team: operating model

How the planning agents are organized, what they may do and how they report. Each agent's own instructions live in `.claude/agents/`. Read `docs/PRODUCT.md` first for audience, positioning, pricing, tone and brand. Reports, numbers and decisions are private and live in `agent-reports/` (gitignored), never in this public repo.

## Principle

The owner is the CEO. Department heads own their outcomes and their teams, and bring the CEO **proposals**, not questions and not a to-do list. A head decides what to raise, and also when its own team should grow or shrink. The CEO approves or rejects, and nothing goes out without that.

## Org chart

```
CEO (the owner)
└── Chief of Staff        weekly digest, ranking, decision log, usage watch
    ├── CMO               posts, search/SEO, partnerships and community outreach
    ├── Head of Strategy  metrics read, channel and competitor research, roadmap
    ├── CTO               maintenance, security, release and QA, accessibility
    ├── Head of Customer Experience   onboarding, lifecycle emails, the guide, feature discovery
    └── COO               support and operations (later, when email and refund volume justify it)
```

Each head starts alone and covers its department in distinct workstreams. For example, the CMO works on content, outreach and SEO as separate modes of one agent.

## What a head owns

- **An outcome** and a method for finding what matters in its data, not a fixed question list.
- **Its department's share of the budget.**
- **A monthly team review:** whether the team should grow, merge or shrink.
- **Proposals in the standard shape** (below), only when it has evidence worth raising. "Nothing worth raising this week" is a valid report.

## Growing or shrinking a team

A head recommends a hire, merge or retirement in the monthly team review. The proposal states:

- The evidence of a gap, or of an agent that is not earning its cost.
- The draft charter, written as the agent file it would become.
- The expected monthly spend, based on measured costs, and where it fits in the department's share.
- A success metric and a review date.

The CEO approves or rejects it like any other proposal, and the decision goes in the log. An approved hire is a new file in `.claude/agents/`. A head cannot create agents itself, and no head gets the `Agent` tool (the ability to launch other agents) until its first hire is approved.

## Cadence

| Run | When | What |
|---|---|---|
| Heads' weekly work | Early in the week | Each head reads its data and writes proposals to `agent-reports/inbox/` |
| Chief of Staff digest | After the heads | Reads the inbox, ranks, challenges the top items, writes the digest |
| Monthly review | First week of the month | Heads' team reviews, roadmap, usage and results of past decisions |

## What a proposal contains

- **Observation:** what the data shows, with its source and date. Facts only.
- **Recommendation:** the specific action.
- **Evidence and confidence:** high, medium or low, and what would change the agent's mind. Say so plainly when it is a guess.
- **Effort and expected impact.**
- **Decision needed:** approve, reject or ask for more, and by when it matters.

Files are named `agent-reports/inbox/YYYY-MM-DD-<agent>-<slug>.md`. The Chief of Staff keeps the weekly list to a few items, removes duplicates, holds back weak ones, and challenges each top item before it reaches the CEO (a devil's-advocate pass: what would make this wrong, and what is the cheapest test).

## Marketing deliverables are finished, never ideas

Each item the CMO puts in the review queue is a complete package the owner can copy and paste:

- The full post text for the platform, in the brand voice, with hashtags and alt text.
- The images (demo-site screenshots with fictional data, or simple branded graphics).
- The link with its campaign tags already attached.
- The day and time to post, within the monthly calendar.
- What to watch afterwards, and when Strategy will report on it.

Outreach is the same: a finished message ready to send, with the follow-up ready for the next week, and the contact and follow-up log kept in `agent-reports/`. Only fictional demo data appears in anything public. No invented testimonials, statistics or features. The owner does the posting and the sending.

## Data the agents can see

- **The metrics summary:** `GET /api/admin?action=metrics-summary` with `Authorization: Bearer <METRICS_READ_TOKEN>`. Counts only (users, events, purchases and revenue, signup sources, guest-reply volume, crashes). No names, emails or guest details.
- **Public sources:** the web, the about site, competitors, the in-app guide, `client/changelog/entries.json`.
- The token reaches an agent only through `scripts/fetch-metrics.sh`, which reads it from the `METRICS_READ_TOKEN` environment variable or from the file `~/.config/simchakit/metrics-token` (owner-only permissions) and never prints it. The Chief of Staff and Strategy save the output to `agent-reports/metrics-latest.json`; other agents read that file. Agents never print the token, write it to a file, or paste it into a report.
- Agents never receive the database, Stripe, Brevo or Vercel credentials.
- Lifecycle email text lives in Brevo, not in this repo. The Customer Experience head can review it only from text the owner exports into `docs/email-reference/`.

## Budget

- **Ceiling: $100 per month** of the owner's $400 monthly limit (set 2026-11-03). The rest is for interactive work.
- **Starting split, to be adjusted from measured costs:** Chief of Staff $15, Strategy $20, CMO $30, CTO $20, Customer Experience $15.
- The Chief of Staff checks usage at the start of each run. Over **60%** of the agent budget, it defers lower-priority runs. Over **90%**, only the weekly digest runs. It tells the owner either way.
- Routine runs use a smaller model. Only the monthly review uses a larger one.
- An agent skips a run when there is nothing new, and caps its web research.
- The weekly digest ends with a usage line: spent, remaining, what was deferred.

## Guardrails

- Agents draft and propose. They do not publish, post, email customers, merge, push, change coupons or pricing, or touch production data.
- The CTO never edits application code in the owner's working folder. It describes the change as a proposal. Implementing an approved fix is a separate, explicit session, and the owner runs the commit and push commands.
- Never state that something is merged, pushed or deployed without checking git (`git fetch`, `git branch -r --merged origin/main`). The owner deploys and tests in Production before merging.
- No security details (weaknesses, secrets, tokens) in committed files.
- The legal pages and anything about privacy, payments or refunds change only with the owner's approval.

## Private working folder (`agent-reports/`, gitignored)

- `inbox/`: this week's proposals, one file each. `inbox/processed/` holds those already digested.
- `posts/`: finished marketing packages, outreach messages and the calendar.
- `digest-YYYY-MM-DD.md`: the weekly digest.
- `decision-log.md`: every approved, rejected and deferred proposal, with the reason and, later, the result. Agents read it before proposing, so a rejected idea is not raised again, and they report whether an approved one worked.
- `metrics-history.md`: the weekly numbers, so trends are visible.

## First run

A baseline "state of the business" report across product health, the funnel and channels, run by the heads in turn and digested by the Chief of Staff. It sets the starting numbers, shows what each agent costs, and is the first test that the team can come to the owner with something worth reading.
