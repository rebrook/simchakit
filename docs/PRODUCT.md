# SimchaKit: product context

Read this before doing any marketing, research, roadmap or support work. It describes who SimchaKit is for and how to talk about it. For how the code works, see `CLAUDE.md`. Facts here come from the owner (Ryan Brook) and the public about site (`client/public/about/`, live at about.simcha-kit.com). Items marked **To confirm** have not been verified.

## What it is

SimchaKit is the planning hub for a family's simcha (B'nei Mitzvot, weddings, baby namings and other Jewish lifecycle celebrations). It brings everything about the celebration into one place, from setting the first date to writing the last thank-you note. It is built by Brook Creative LLC. The founder planned a bat mitzvah across six spreadsheets, an email folder and sticky notes, built SimchaKit to replace that, and has since used it to plan a real bat mitzvah start to finish.

- App: app.simcha-kit.com (sign in with an emailed magic link; no passwords)
- Marketing site: about.simcha-kit.com. Free demo with fictional data: demo.simcha-kit.com
- Contact: hello@simcha-kit.com. There is also a Facebook page.

## Audience

**Primary: families planning a simcha**, usually one organizer who ends up holding everything, plus co-planners (spouse, parents, relatives). Secondary: clergy or tutors, who get a limited Ritual Coordinator role (ceremony and prep tabs only).

**The pain:** the plan is scattered across documents, notes, emails, group texts, spreadsheets and various tools. Nobody can quickly answer basic questions, and details fall through the cracks.

## Positioning

**SimchaKit is the source of truth for everything about the simcha.** One place holds the answers, kept current on every device. The test is whether it can answer the questions a family actually asks:

- How many people are coming to the reception?
- What size favors do the kids need?
- How many kosher meals do we need?
- Did my cousin get a save the date?
- Where is everyone sitting?
- Did I pay the DJ?
- Who did I buy the dress from?

It is built specifically for simchas, not a generic event app. That shows in sub-events (service, kiddush, reception) with per-person attendance, kosher and meal counts, ceremony roles, Hebrew dates and Shabbat times, and a thank-you tracker that handles gifts from several families.

**Role in the family's life:** it stands in for the planner, the family member or the memory that otherwise has to keep track of everything. It does the remembering, counting and reminding so the family does not have to.
- Confirmed by the owner: this means replacing the informal human coordinator and scattered notes. It is not a claim to replace a professional planner, clergy, caterers or vendors. Do not make that stronger claim in public copy without the owner's say.

## What it does (current, V5)

Guests (households, people, RSVPs per sub-event, dietary needs, formal names, CSV import and export), guest RSVP pages sent by private link and reviewed by the host, email to guests from the Guests tab, budget and payment schedules, vendors and contracts, tasks with smart suggestions, seating with Auto-Seat, gifts and thank-you tracking, favors, ceremony roles, calendar sync, a printable event brief, Day-of Mode for phones, an Overview dashboard with "what needs you next", up to five co-planners (editors or viewers) plus a Ritual Coordinator at no extra cost, live sync across devices, theming per event, and full data export and backup.

The in-app Guide (`client/src-v3/constants/guideContent.js`) and `client/changelog/entries.json` (the host-facing "What's new") are the most accurate feature references. When they disagree with this file, they win.

## Pricing

- **$49 per event, one time.** No subscription, no recurring charges. Every feature is included. Collaborators are covered by the same purchase. The demo is free.
- **Coupons** (managed in the admin console) can give a percentage off or a free event. The owner offers them to members of their congregation and to returning customers.
- Never invent coupon codes or discounts. Promotions are the owner's decision.
- The $29 intro price ended 2026-08-31. Public copy should say $49 only.

## Tone

Take the about site and the in-app Guide as the baseline: warm, plain, practical, and respectful of the occasion. Short sentences. Lead with what the family can now do ("Know who still owes you an answer"), not with the feature name. A little mazel tov is fine; hype, jargon and tech talk are not. Speak to the organizer as a busy person doing something meaningful. The release-note rules in `client/changelog/README.md` (benefit-first, one sentence, no version numbers, table names or "API") are a good model for any public copy.

## Brand (marketing site and posts)

From the about site's own styles (`client/public/about/index.html`). The app itself has nine selectable palettes, so use these for marketing, not the app's colors.

- **Colors:** navy `#1e3a5f` (primary), lighter navy `#2d5a8a`, gold `#c9a227` (accent), warm paper background `#faf8f5` and `#f4f1ec`, text `#2c2520`, muted text `#6b6058`.
- **Fonts:** Cormorant Garamond (headings), DM Sans (body).
- **Logo:** `client/public/about/SimchaKit-logo.png`.
- **Screenshots:** `client/public/about/` has `overview.png`, `screenshot-guests.png`, `screenshot-seating.png`, `screenshot-budget.png`, `mobile-overview.png` and `mobile-dayofmode.png`. Look at an image before using it and use it only if it shows fictional demo data (the demo event uses the Simpsons family). A screenshot with a real family's names is never used.
- **Links in posts** always carry campaign tags: `?utm_source=<platform>&utm_medium=<social|email|referral>&utm_campaign=<short-name>`. The about site passes them on to the app.

## Goals right now

1. **Awareness first.** The main problem is that people do not know SimchaKit exists, what it does, or how it could help them. Revenue growth comes later.
2. **Adoption.** Get families to try the demo, then start an event.
3. Revenue and sales growth are the longer-term aim. Do not optimize for them at the expense of trust or tone.

Channels that exist today: the Facebook page, the about site and its Resources section (e.g. the Simcha Planning Checklist), the demo site, and `llms.txt` for AI search. The channels that exist are small. A marketing agent should propose channels and content, not assume an audience.

## Public copy status

The about-site FAQ and `llms.txt` were corrected (2026-11-03) to say guests need no account but can reply through a private RSVP link, and that hosts can email guests. The hero badge "No guest accounts" is still accurate.

**Privacy policy and terms are out of date and need the owner's decision** (`client/public/about/privacy.html`, `terms.html`; not legal advice, review with a lawyer if in doubt):
- The policy says "Guests never use SimchaKit". Guests now submit data through RSVP links: names, meal and dietary choices, addresses, notes and plus-ones.
- Brevo is described as receiving only account and collaborator invitation emails. It now also sends guest emails.
- Stripe (payments) and Vercel (hosting and analytics) are not listed as processors. The app loads Vercel Analytics and Speed Insights.
- Nothing mentions guest email opt-out (unsubscribe links), how long data is kept after an event, or archived events.
- The terms do not mention emailing guests or the organizer's responsibility for it.

## Guardrails for agents working from this file

- Do not publish, post, email customers or change coupons or pricing without the owner's explicit approval. Drafts are fine.
- Do not claim features that are not in the Guide or What's new, and do not promise roadmap items.
- Do not use real guest, family or event data in marketing material. Use the demo event's fictional data.
- Do not state security, privacy or compliance claims beyond what the privacy policy and the about FAQ already say.
