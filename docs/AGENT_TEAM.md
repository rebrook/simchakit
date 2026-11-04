# Agent team: how it works

The owner is the CEO. The team brings **finished recommendations** to the admin console's Weekly briefing page, the owner answers there, and the team acts on the answers. The owner never opens a file, a folder or another tool to review. Read `docs/PRODUCT.md` first for audience, positioning, pricing, tone and brand. Everything private (numbers, decisions, replies) lives in the app's database and the briefing page, never in this public repo.

## The loop

1. **Monday, 8:00 am Eastern: the briefing run** (a cloud routine). It reads the numbers and last weeks' answers, runs the department heads, has the Chief of Staff rank the results, fact-checks them, publishes the digest to the briefing page and pushes a notification to the owner's phone ("Weekly briefing ready: N decisions").
2. **The owner reviews on the briefing page.** Each decision shows a mockup (the finished post, or a before and after of the screen), the few things the team needs from the owner (each with a reason, an example and a "skip this" option), the evidence, and four buttons: Approve, Not now, Reject, I have a question.
3. **Every day: the check run** (a cloud routine). It reads new answers. It does the work for approved items, answers questions, and records each item's status on the page. It sends a phone notification only when something needs the owner: a reply, something ready to ship, or a missing input. With nothing new it ends silently.
4. **When work is ready,** the page shows a "Ready to ship" card: the exact steps, in order, with copy buttons. Migration first, then deploy, promote to Production, test, merge.

## What each run must do

### Briefing run

Work from the repo root. Never print a key or write one to a file. Scratch files go in `agent-reports/` (ephemeral and gitignored).

1. `mkdir -p agent-reports`. Fetch the history: `curl -s -H "Authorization: Bearer $DIGEST_INGEST_TOKEN" 'https://app.simcha-kit.com/api/admin?action=digest-decisions&weeks=12' > agent-reports/decisions.json`. This is the decision log: what was approved, rejected, deferred or asked, the owner's answers, and the past digests' numbers. Then `sh scripts/fetch-metrics.sh > agent-reports/metrics-latest.json`. If either fails, say so in the digest and carry on without it.
2. Run the heads one after another with the Agent tool: `cto`, `head-of-strategy`, `head-of-customer-experience`, `cmo`. Each writes its proposals to `agent-reports/inbox/` and skips the run if it has nothing worth raising.
3. Run `chief-of-staff`. It reads the inbox, challenges and ranks, and writes `agent-reports/digest.json` in the shape below.
4. **Independent fact check.** A fresh agent gets only the digest and the repo (not the proposals' reasoning) and checks every claim about what is merged, deployed or live, what a policy or screen says, what a number means and when its data begins. It reports each claim as confirmed, wrong or unverifiable. Fix wrong claims, label unverifiable ones, then set `fact_checked` to true. If this step did not run, leave it false.
5. Publish: `curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $DIGEST_INGEST_TOKEN" --data-binary @agent-reports/digest.json 'https://app.simcha-kit.com/api/admin?action=digest-ingest'`. Expect `{"stored":true,...}`.
6. Send a push notification: "Weekly briefing ready: N decisions". If publishing failed, say what failed.

### Check run

1. Fetch `digest-decisions` (as above, `weeks=4`) into `agent-reports/decisions.json`.
2. Find the latest decision row of each item that has no `picked_up_at`. If there are none, stop silently.
3. For each one, first record it: `POST` to `digest-decisions` with `{"id": "<decision id>", "picked_up": true, "team_status": "picked_up"}`. Then:
   - **approved:** do the work, set `team_status` to `in_progress`, and when finished set `ready_to_ship` or `done`. Use the owner's answers in `answers`. A skipped ask means the owner chose the fallback written in its `skip_means`.
   - **question:** write the answer in `team_reply` (plain language, short). The owner sees it under the decision.
   - **rejected or deferred:** record it only. Do not raise it again without new evidence.
   - If the team cannot proceed (for example a missing input or no write access), set `team_status` to `needs_input` or `declined` and say why in `team_reply`.
4. **Code changes** are made in the cloud checkout on a branch named `team/<short-slug>`, built with the V3 config, and pushed. Never push to `main`. If the push is refused, set `needs_input` and say the Claude GitHub app is not installed on the repository. Never claim something is merged, pushed or deployed without checking git.
5. **Ready to ship:** re-publish the week's digest with a `ship` card added. First `GET` the digest from `digest-decisions` and send back the same payload (the same decisions in the same order, so item numbers and answers stay attached), plus the card. A ship card lists, in order: the migration to run (if any), the branch and a compare link `https://github.com/rebrook/simchakit/compare/<branch>?expand=1` to open the pull request, promote the build to Production in Vercel, a short test checklist, and the merge.
6. Push a notification when anything needs the owner, naming how many items.

## The digest

```json
{
  "week_of": "YYYY-MM-DD",
  "fact_checked": true,
  "numbers": [{"label": "", "value": "", "note": ""}],
  "decisions": [{
    "title": "",
    "recommendation": "",
    "confidence": "",
    "effort": "",
    "why": "",
    "could_be_wrong": "",
    "mockup": {"kind": "post", "heading": "Facebook post", "when": "Thu 8:00 pm", "text": "", "image_url": "https://...", "image_alt": ""},
    "asks": [{"label": "", "why": "", "example": "", "skip_means": ""}],
    "checks": [{"claim": "", "status": "checked"}]
  }],
  "ship": [{"title": "", "steps": [{"text": "", "code": ""}]}],
  "held_back": [""],
  "usage": "",
  "link": ""
}
```

- **At most five decisions,** ranked. Sending the same `week_of` again replaces that week's digest, and decisions stay attached by item number.
- **`mockup.kind`** is `post` (the finished text, an `https` image, when to post it) or `screen` (`heading`, `where`, `before`, `after`, optional `before_image_url` and `after_image_url`). Every decision that changes something the owner can see has a mockup.
- **`asks`** hold only what the owner must supply. Each says why it is needed and gives an example. Each has `skip_means`, the plain default the team will use if the owner skips it (for example "I'll write a generic version you can adapt"). Never ask for something the team can find out itself. Text is clipped, so keep fields short.
- **`checks`** mark each factual claim `checked` or `unverified`. A claim about repo, deploy, site or policy state is checked against the file or `git`, not against `docs/PRODUCT.md` or another agent. When a number is zero or low, name the other explanations and say which were ruled out.
- **Images** must be `https` URLs. Use screenshots from the repo (`https://raw.githubusercontent.com/rebrook/simchakit/main/...`) or the about site, with fictional demo data only.

## Department heads

| Head | Owns |
|---|---|
| Chief of Staff | ranks and challenges proposals, writes the digest |
| CMO | finished posts, outreach messages, search/SEO pages, the four-week content plan |
| Head of Strategy | the metrics read, channel and competitor research, the monthly roadmap |
| CTO | app health, security, release checks, accessibility, implementing approved changes |
| Head of Customer Experience | onboarding, the guide, lifecycle emails, feature discovery |

Each head decides what is worth raising. "Nothing worth raising this week" is a valid report. A proposal states the observation (with source and date), the specific recommendation, confidence and what would change the agent's mind, effort and impact, and the decision needed.

Heads recommend their own team changes (a hire, merge or retirement) in the monthly review, with the evidence, a draft agent file, the expected cost and a review date. The owner approves it like any other decision. Heads cannot create agents.

## Marketing deliverables are finished, never ideas

Each post is a complete package the owner can paste: the full post text in the brand voice with hashtags and alt text, the image, the link with its campaign tags already attached, and the day and time. Outreach is a finished message ready to send, with a follow-up ready for the next week. Only fictional demo data appears in anything public. No invented testimonials, statistics or features. The owner does the posting and the sending.

## Guardrails

- Agents draft and propose. They do not publish, post, email customers, merge, change coupons or pricing, or touch production data.
- The team never pushes to `main`. The owner runs the migration, promotes, tests and merges.
- The legal pages and anything about privacy, payments or refunds change only with the owner's approval. A change that collects, emails or shares different personal data must update `client/public/about/privacy.html`.
- No security details (weaknesses, secrets, keys) in committed files.
- Agents never print a key, write it to a file, or paste it into a report. The routine's keys are `METRICS_READ_TOKEN` (read-only counts, no names or emails) and `DIGEST_INGEST_TOKEN` (store a digest, read answers, record status). Neither can read customer data.

## Cost

Both routines use Sonnet. A head skips its run when nothing is new, and the check run ends silently with nothing to do. The owner checks the Claude usage page after the first two Monday runs; if a run costs more than expected, tighten the routine's prompt first, then drop a head from the weekly run.
