# Take-home Notes

## Setup

Requirements:

- Node.js 20+
- pnpm
- Docker

Install dependencies:

```bash
pnpm install
```

Start Postgres:

```bash
docker compose up -d
```

Create a local `.env` file with the database connection string expected by the application and `drizzle.config.ts`.

Apply the committed Drizzle migrations:

```bash
pnpm drizzle-kit migrate
```

Seed the database:

```bash
pnpm db:seed
```

Start the development server:

```bash
pnpm dev
```

Open `http://localhost:3000`.

The application uses a signed cookie and a development-only user switcher instead of a real authentication provider, as requested.

Useful commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm ingest
```

The generated Drizzle migrations are committed under `drizzle/`.

## Concurrent Approvals

The main invariant is that approved payouts must never exceed the campaign budget.

A simple read-then-write implementation would have a race condition: two admins could read the same remaining budget and both approve submissions against it.

I handle approval inside a database transaction and lock the campaign row with `SELECT ... FOR UPDATE`.

The approval flow is:

1. Load the submission and verify that it is still `pending`.

2. Lock the associated campaign row.

3. Read the latest submission metric.

4. Calculate the approval payout using:

   `floor(views / 1000) * payout_per_1k_views`

5. Calculate already reserved campaign spend from `approvedPayout` on approved submissions.

6. Compare the new payout with the remaining budget.

7. Approve the submission and store its calculated payout in `approvedPayout`.

8. If the budget is fully consumed, mark the campaign as `completed`.

9. Commit the transaction.

Because the campaign row is locked for the duration of the transaction, concurrent approvals for the same campaign are serialized.

If only enough budget remains for one approval, the first transaction that obtains the lock and commits consumes that budget. The competing transaction then observes the updated state and fails with a typed `CONFLICT` error instead of exceeding the budget.

I considered a normal read/check/update flow without row locking, but ruled it out because it cannot guarantee the budget invariant under concurrent approvals.

`approvedPayout` stores the payout calculated at approval time and is used as the approval-time budget reservation. Separately, the campaign overview and submission lists calculate current displayed spend and creator earnings from the latest available metric for approved submissions, using a shared allocation function (see below) so that reservation and display stay aligned.

## Payout and Budget

All monetary values are stored as integer cents.

The payout calculation is:

```text
floor(views / 1000) * payout_per_1k_views
```

At approval time, the calculated payout is checked against the campaign's remaining reserved budget (based on `approvedPayout` for already-approved submissions). An approval fails if the payout would exceed that budget.

### Known limitation, and the fix: post-approval view growth vs. the budget cap

The approval-time check only guards the moment of approval. After a submission is approved, `pnpm ingest` keeps increasing its view count every day. Both the campaign overview and the creator/admin submission lists originally recomputed displayed earnings independently from the _latest_ metric row for each approved submission, with no shared cap. That meant the displayed numbers could keep growing past `total_budget` after approval, even though no single approval was ever allowed to exceed it.

I hit this directly while testing: a campaign with a $0.10 budget and $0.05/1k payout showed **Spent: $0.25** on the campaign overview after ingest pushed a single approved submission's views to 5,151, and the submission's own "Earnings" column separately showed **$0.25** as well — two different code paths, both wrong, and inconsistent with each other on top of that.

The root cause was that `campaign.service.ts` (overview) and `submission.service.ts` (submission lists) each computed payout independently from raw views, with no shared budget ceiling. My first pass capped the overview's total with `Math.min(rawSpent, totalBudget)`, but that only fixed the aggregate number on one page — it didn't fix the per-submission earnings shown elsewhere, and it wouldn't have generalized correctly to a campaign with multiple approved submissions competing for the same remaining budget.

The actual fix: a single `allocateBudget` function in `src/modules/campaigns/payout.ts` is now the one place that turns "raw payout per submission" into "budget actually attributed to that submission." It walks a campaign's approved/paid submissions in approval order (first-come-first-served, per spec, approximated by `updatedAt`) and caps the running total at `total_budget`. Both the campaign overview (`getCampaignOverview`) and the submission list queries (`listMySubmissions`, `listSubmissionsByCampaign`) call this same function, so:

- the campaign overview's "Spent" is the sum of what `allocateBudget` attributes to each approved submission in that campaign
- each submission's displayed "Earnings" is exactly its own entry from that same allocation

These two numbers can now never disagree, and neither can exceed `total_budget`. This is covered by a dedicated regression test on `getCampaignOverview` (spent never exceeds `total_budget` even after post-approval view growth).

This is still a display-layer fix, not a root-cause fix. The actual reserved spend used for approval decisions (`approvedPayout`) is unaffected by view growth and was never at risk of exceeding budget — the bug only affected what was _displayed_ after the fact. What's still unresolved is the underlying question of how a creator's "earnings" should behave once their submission keeps racking up views after the campaign is effectively fully paid out — right now they simply stop being credited once the campaign's budget is exhausted, silently. Given another day I'd address this by either freezing a submission's counted views once the campaign's approved budget is exhausted, or excluding submissions from further ingest once the campaign is `completed` — see "What I Would Fix With Another Day."

Budget left is clamped at zero and the campaign is automatically marked as `completed` when the approval-time budget is fully consumed (based on `approvedPayout`, independent of the display allocation above).

## Access Control

There is intentionally no production authentication provider.

A signed cookie identifies the current development user. Server-side tRPC procedures enforce roles and ownership.

Creator queries scope submissions using the authenticated creator ID from the server-side session rather than trusting a creator ID supplied by the client.

Therefore, changing IDs in a manually crafted tRPC request cannot be used to access another creator's submissions.

Admin procedures require the authenticated user to have the `admin` role.

## Submission Validation

A submission must:

- belong to an active campaign
- use a platform supported by that campaign
- contain a URL matching the selected platform
- not duplicate an existing submission for the same campaign

The campaign + post URL combination also has a database uniqueness constraint, so concurrent duplicate submissions cannot bypass the application-level check.

## Metrics Ingestion

`pnpm ingest` simulates a daily third-party metrics synchronization.

For approved submissions it maintains one metric row per submission/day.

The ingestion is idempotent: running it repeatedly for the same day does not create duplicate metric rows, and existing view counts are not reduced.

Views are monotonic and only move upwards.

Submissions are processed independently so a failure for one submission does not prevent the remaining submissions from finishing. Failures are reported after the run.

Note: ingestion currently keeps running for approved submissions regardless of whether the campaign has been marked `completed`. This is what produces the post-approval view growth described above. The display-side allocation fix means this no longer produces a budget overrun in the UI, but it does mean views keep accumulating on a submission whose earnings are already capped, with no further effect. Given another day I would stop ingesting metrics for submissions belonging to a `completed` campaign.

## What I Left Out

I intentionally kept the implementation focused on the requested marketplace flow.

I did not implement:

- Real authentication or an external identity provider
- Real TikTok, Instagram, or YouTube API integrations
- Real payment processing
- Background job infrastructure
- Notifications
- Creator profiles
- Advanced analytics
- Fraud detection
- Production-grade moderation workflows
- Custom visual design work

These were intentionally left out to keep the implementation small and focused on correctness of the money flow.

## What I Would Fix With Another Day

The first thing I would fix is stopping metrics ingestion for submissions in a `completed` campaign (or freezing counted views once a submission's payout share of the budget is fully reserved), so views stop accumulating pointlessly once a campaign's budget is exhausted.

After that, I would improve the production-readiness of metrics ingestion generally: move it to a background job system with retries, explicit ingestion-run records, structured failure reporting, and handling for external API rate limits and transient failures.

I would also expand the integration-test coverage against a real Postgres instance, particularly around transaction and locking behavior, and around `allocateBudget` with multiple competing submissions in the same campaign.

## AI Tooling

I used AI tooling as a development aid for implementation, debugging, test-case exploration, and reviewing edge cases.

I did not treat generated code as authoritative. I manually reviewed and corrected the output, especially around:

- payout calculation
- budget ceiling enforcement
- concurrent approval behavior
- transaction boundaries
- creator ownership checks
- duplicate submission protection
- idempotent metrics ingestion
- TypeScript and ESLint issues

I also found, while manually testing the running app, that the campaign overview's displayed "spent" could exceed `total_budget` after post-approval view growth (a $0.10 budget campaign showing $0.25 spent), and that a submission's own displayed "Earnings" disagreed with the campaign overview's total (both showing $0.25 independently, from two different code paths). Neither of these was something AI tooling flagged on its own; I caught both by exercising the running UI. I then used AI assistance to help implement and test the fix: extracting a single `allocateBudget` function used by both the campaign overview and the submission list queries, so displayed spend and per-submission earnings are always derived from the same allocation and never exceed budget. I wrote up the remaining root cause (ingestion not stopping on campaign completion) in "Known limitation" above rather than treating this as a full fix.

The final implementation was manually verified with:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Current local verification:

- ESLint: 0 errors, 0 warnings
- TypeScript: passing
- Vitest: 15/15 tests passing
- Production build: passing
