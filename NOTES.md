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

`approvedPayout` stores the payout calculated at approval time and is used as the approval-time budget reservation. Separately, the campaign overview calculates current displayed spend and creator earnings from the latest available metric for approved submissions. This keeps the approval concurrency invariant while allowing the overview to reflect current view-based earnings.

## Payout and Budget

All monetary values are stored as integer cents.

The payout calculation is:

```text
floor(views / 1000) * payout_per_1k_views
```

At approval time, the calculated payout is checked against the campaign's remaining reserved budget (based on `approvedPayout` for already-approved submissions). An approval fails if the payout would exceed that budget.

### Known limitation: post-approval view growth vs. the budget cap

The approval-time check only guards the moment of approval. After a submission is approved, `pnpm ingest` keeps increasing its view count every day, and the campaign overview recomputes displayed earnings from the _latest_ metric row for each approved submission. That means the displayed "spent" figure is derived independently from `approvedPayout`, and can in theory keep growing past `total_budget` after approval, even though no single approval was ever allowed to exceed it.

I hit this directly while testing: a campaign with a $0.10 budget and $0.05/1k payout showed **Spent: $0.25** after two ingest runs pushed a single approved submission's views to 5,151. `budgetLeft` was clamped at zero by `Math.max(totalBudget - spent, 0)`, which hid the overrun instead of surfacing it.

I fixed the overview so displayed spend is capped at the campaign's `total_budget`:

```ts
const spent = Math.min(rawSpent, campaign.totalBudget);
```

This guarantees the UI-facing invariant ("a campaign never shows itself paying out more than its budget") holds, and is covered by a dedicated test (`getCampaignOverview` — never reports spent above `total_budget`).

This is a display-layer fix, not a root-cause fix. The actual reserved spend used for approval decisions (`approvedPayout`) is unaffected by view growth and was never at risk of exceeding budget. What's undefined is how "earnings" should behave for a creator whose submission keeps racking up views after the campaign is effectively fully paid out. Given another day I'd address this by either freezing a submission's counted views once the campaign's approved budget is exhausted, or excluding submissions from further ingest once the campaign is `completed` — see "What I Would Fix With Another Day."

The campaign overview uses the latest metric for each approved submission to calculate current displayed spend and earnings, capped as described above. Budget left is clamped at zero and the campaign is automatically marked as `completed` when the approval-time budget is fully consumed.

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

Note: ingestion currently keeps running for approved submissions regardless of whether the campaign has been marked `completed`. This is what produces the post-approval budget overrun described above. Given another day I would stop ingesting metrics for submissions belonging to a `completed` campaign.

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

The first thing I would fix is the post-approval view growth issue described above: stop ingesting metrics for submissions in a `completed` campaign (or freeze counted views once a submission's payout share of the budget is fully reserved), so displayed spend and creator earnings never need a defensive cap.

After that, I would improve the production-readiness of metrics ingestion generally: move it to a background job system with retries, explicit ingestion-run records, structured failure reporting, and handling for external API rate limits and transient failures.

I would also expand the integration-test coverage against a real Postgres instance, particularly around transaction and locking behavior.

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

I also found, while manually testing the running app, that the campaign overview's displayed "spent" could exceed `total_budget` after post-approval view growth (a $0.10 budget campaign showing $0.25 spent). This was not something AI tooling flagged on its own; I caught it by exercising the UI, then used AI assistance to help implement and test the fix (capping displayed spend at `total_budget` and adding a regression test), and wrote up the remaining root cause in "Known limitation" above rather than treating the cap as a full fix.

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
