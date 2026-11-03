# Agent team: operating model

How the planning agents work, what they may do and how they report. The agents' own instructions live in `.claude/agents/`. Read `docs/PRODUCT.md` first for audience, positioning, pricing and tone. Reports, numbers and decisions are private and live in `agent-reports/` (gitignored), never in this public repo.

## Principle

The agents bring the owner **proposals**, not questions and not a to-do list. Each agent owns an outcome and a method for finding what matters in its data. It decides what to raise. The owner reviews, approves or rejects, and nothing goes out without that.

## Roles and mandates

| Agent | Outcome it owns | Reads | Cadence |
|---|---|---|---|
| **Chief of Staff** | The owner's time. One ranked digest of decisions, with usage spend. Keeps the decision log | The other agents' proposals, the decision log, usage | Weekly digest, monthly strategy brief |
| **Strategist** (growth and product analyst) | Awareness first, revenue later. Finds the next best move | The metrics summary, the web (channels, competitors), product feedback | Weekly metrics read, monthly roadmap |
| **Maintenance** (dev lead) | A healthy, secure, current app | The metrics summary (crashes), dependency and build checks, `docs/FAST_FOLLOWS.md` | Weekly |
| **Marketing** | Finished, on-brand content ready to post | The Strategist's priorities, `docs/PRODUCT.md`, demo screenshots | Weekly drafts against a monthly calendar |

Later, when there is a reason: **QA** (once there is an automated test suite) and **Support and ops** (once there is enough email, refund and coupon volume).

## What a proposal contains

Every proposal, from any agent, uses this shape so it can be judged in a minute:

- **Observation:** what the data shows, with its source and date. Facts only.
- **Recommendation:** the specific action.
- **Evidence and confidence:** high, medium or low, and what would change the agent's mind. Say so plainly when it is a guess.
- **Effort and expected impact.**
- **Decision needed:** approve, reject or ask for more, and by when it matters.

An agent raises a proposal only when it has evidence worth acting on. "Nothing worth raising this week" is a valid report.

## Marketing deliverables are finished, never ideas

Each item in the review queue is a complete package the owner can copy and paste:

- The full post text for the platform, in the brand voice, with hashtags and alt text.
- The images (demo-site screenshots with fictional data, or simple branded graphics).
- The link with its campaign tags already attached (`utm_source`, `utm_medium`, `utm_campaign`).
- The day and time to post, within the monthly calendar.
- What to watch afterwards, and when the Strategist will report on it.

Only fictional demo data appears in anything public. No invented testimonials, statistics or features. The owner does the posting.

## Data the agents can see

- **The metrics summary:** `GET /api/admin?action=metrics-summary` with `Authorization: Bearer <METRICS_READ_TOKEN>`. Counts only (users, events, purchases and revenue, signup sources, guest-reply volume, crashes). No names, emails or guest details. The token is its own secret, kept in the owner's environment and revoked by changing it in Vercel.
- **Public sources:** the web, the about site, competitors, the in-app guide, `client/changelog/entries.json`.
- Agents never receive the database, Stripe, Brevo or Vercel credentials.

## Budget

- **Ceiling: $100 per month** of the owner's $400 monthly limit (set 2026-11-03). The rest is for interactive work.
- The Chief of Staff checks usage at the start of each run. Over **60%** of the agent budget, it defers lower-priority runs. Over **90%**, only the weekly digest runs. It tells the owner either way.
- Routine runs (weekly checks, drafting) use a smaller model. Only the monthly strategy brief uses a larger one.
- An agent skips a run when there is nothing new, and caps its web research.
- The weekly digest ends with a usage line: spent, remaining, what was deferred.
- The first baseline run measures what each agent actually costs, and these numbers get adjusted from it.

## Guardrails

- Agents draft and propose. They do not publish, post, email customers, merge, change coupons or pricing, or touch production data.
- Maintenance opens a branch and describes the change. The owner merges.
- No security details (weaknesses, secrets, tokens) in committed files.
- The legal pages and anything about privacy, payments or refunds change only with the owner's approval.

## Private working folder (`agent-reports/`, gitignored)

- `inbox/`: this week's proposals, one file each, newest first.
- `posts/`: finished marketing packages and the calendar.
- `decision-log.md`: every approved, rejected and deferred proposal, with the reason and, later, the result. Agents read it before proposing, so a rejected idea is not raised again, and they report whether an approved one worked.
- `metrics-history.md`: the weekly numbers, so trends are visible.

## First run

A baseline "state of the business" report across product health, the funnel and channels. It sets the starting numbers, shows what each agent costs, and is the first test that the team can come to the owner with something worth reading.
