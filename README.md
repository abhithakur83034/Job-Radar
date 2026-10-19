# JobRadar

Job opening radar & tailored-application assistant. This is the working
implementation of `JobRadar_Project_Documentation.pdf` — a Next.js app that
watches job platforms, scores new listings against your resume with Claude,
pre-drafts a tailored resume/cover letter per match, and tracks applications
through to follow-up.

Submission itself stays manual by design (see doc section 2.3) — JobRadar
gets you to "ready to submit" in seconds, the actual click on the job board
is always yours.

## Quick start

```bash
npm install
npm run db:push    # creates the local SQLite database from prisma/schema.prisma
npm run db:seed    # loads one demo user, a resume, 6 listings/matches, and applications
npm run dev
```

Open http://localhost:3000 — it redirects to the Match Feed with the seeded
demo data already in place, matching the design reviewed before this build:
`https://claude.ai/code/artifact/37c5bdd4-b8bb-444e-9ccb-bc88ccacbe1b`.

### A note on navigation speed

`npm run dev` compiles each route on-demand the *first* time you visit it in
a session — that's the 2-3s pause you'll feel once per route after starting
the dev server, and it's normal `next dev` behavior, not an app issue.
Repeat visits are fast (pages are cached and revalidated on-demand via
`revalidatePath`, not re-fetched from scratch every time). For a realistic
sense of production speed — no per-route compile pause at all, ~70-160ms
navigation measured end to end — run:

```bash
npm run build
npm run start
```

No environment variables are required to run the app. Without an
`ANTHROPIC_API_KEY`, match scoring, tailoring, and follow-up drafts fall back
to deterministic mock logic (clearly labeled in the output) so the whole
product is explorable offline.

## Environment variables

Copy `.env.example` to `.env` and fill in what you have:

| Variable | Required for | Notes |
|---|---|---|
| `DATABASE_URL` | Everything | Defaults to a local SQLite file — zero setup. |
| `ANTHROPIC_API_KEY` | Real match scoring / tailoring / follow-ups | Falls back to mock output if unset. |
| `RESEND_API_KEY`, `WHATSAPP_CLOUD_TOKEN` | Phase 3 (notifications) | Not yet wired into the app. |
| `STRIPE_SECRET_KEY` | Phase 6 (billing) | Not yet wired into the app — billing screen is read-only. |

## What's actually implemented vs. scaffolded

Matching the doc's own scope boundaries (section 4.3) and build plan
(section 11), here's the honest state of this codebase:

**Real and working:**
- All 6 screens from section 8, wired to a real database (not static mocks): Match Feed, Search Profile Settings, Onboarding Wizard, Tailored Draft Review, Application Tracker, Account & Billing.
- Greenhouse source connector (`src/lib/connectors/greenhouse.ts`) — hits the real public `boards-api.greenhouse.io` endpoint, no auth, no scraping (doc section 2.1, "High reliability" tier).
- Claude-based match scoring (`src/lib/scoring.ts`), resume/cover-letter tailoring (`src/lib/tailoring.ts`), and follow-up drafting (`src/lib/followup.ts`) — all three prompts from doc section 10, using forced tool-use for structured output.
- The full data model from doc section 9 (`prisma/schema.prisma`).
- Application tracker with real 7-day follow-up detection (`src/lib/tracker.ts`) and one-click drafted follow-ups.

**Scaffolded / stubbed (flagged in code and UI, not silently faked):**
- **Resume parsing** — the onboarding upload step is presentational; there's no PDF/DOCX text-extraction yet (that's doc build Phase 2). The seeded demo resume already has parsed content so every other screen has real data to work with.
- **Scheduling** — `/api/listings/sync` does the real work of a monitoring cycle but isn't wired to a cron/queue yet (doc mentions BullMQ+Redis or simple cron — Phase 1). Trigger it manually for now:
  ```bash
  curl -X POST http://localhost:3000/api/listings/sync \
    -H "Content-Type: application/json" \
    -d '{"boardTokens": ["gitlab"]}'
  ```
  (Board token = the slug in a company's `boards.greenhouse.io/<token>` careers URL.)
- **Notifications** (push/WhatsApp/email dispatch) — Phase 3, not built.
- **Billing** (Stripe) — Phase 6, not built; the billing screen reads real usage from the database but upgrade buttons aren't wired to checkout.
- **Auth / multi-tenancy** — this is a single-tenant demo (one seeded user). Add real accounts before this goes further than a personal tool.

## Moving to Postgres/Supabase

`prisma/schema.prisma` targets SQLite for zero-setup local dev. Per doc
section 6.2, production should run on Postgres via Supabase (bundled auth +
storage on the free tier). To switch:

1. Change `datasource db { provider = "sqlite" ... }` to `provider = "postgresql"`.
2. Point `DATABASE_URL` at your Supabase/Neon connection string.
3. Re-enable native arrays/enums if you want them — the SQLite-compatible schema stores array fields (`titles`, `keywords`, etc.) as JSON strings via the `toJson`/`fromJson` helpers in `src/lib/db.ts`; Postgres can use `String[]` directly if you'd rather drop that indirection.
4. `npm run db:push && npm run db:seed`.

## Known issues

`npm audit` reports 2 high-severity advisories against Next 14.2.35's
bundled dependencies (a nested `postcss` and one Next.js server-function
disclosure issue) that are only fully resolved on Next 15/16 — a breaking
major-version jump out of scope for this pass. Fine for local dev; revisit
before any real deployment.

## Project structure

```
prisma/schema.prisma        Data model (doc section 9)
prisma/seed.ts               Demo data matching the reviewed design
src/lib/connectors/          Source connectors (Greenhouse implemented; Lever/Workday/etc. per doc 2.1 follow the same NormalizedListing interface)
src/lib/scoring.ts           Match scoring (doc 10.1)
src/lib/tailoring.ts         Resume/cover-letter tailoring (doc 10.2)
src/lib/followup.ts          Follow-up drafting (doc 10.3)
src/lib/tracker.ts           Follow-up due-date logic (doc 7.4)
src/app/(dashboard)/         The 5 persistent-nav screens
src/app/onboarding/          4-step onboarding wizard (doc 8.1)
src/app/api/                 Route handlers for sync / scoring / tailoring / follow-ups
```
