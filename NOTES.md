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
4. Calculate the payout using:
   `floor(views / 1000) * payout_per_1k_views`
5. Calculate already reserved campaign spend from `approvedPayout` on approved submissions.
6. Compare the new payout with the remaining budget.
7. Approve the submission and store its calculated payout in `approvedPayout`.
8. If the budget is fully consumed, mark the campaign as `completed`.
9. Commit the transaction.

Because the campaign row is locked for the duration of the transaction, concurrent approvals for the same campaign are serialized.

If only enough budget remains for one approval, the first transaction that obtains the lock and commits consumes that budget. The competing transaction then observes the updated state and fails with a typed `CONFLICT` error instead of exceeding the budget.

I considered a normal read/check/update flow without row locking, but ruled it out because it cannot guarantee the budget invariant under concurrent approvals.

`approvedPayout` represents the budget reservation captured at approval time. Later metric growth changes the displayed earnings calculation, but does not retroactively increase the amount reserved against the campaign budget.

## Payout and Budget

All monetary values are stored as integer cents.

Payout is calculated from the latest metric:

```text
floor(views / 1000) * payout_per_1k_views
```

An approval fails if the calculated payout would exceed the campaign's remaining budget.

When the budget is fully consumed, the campaign is automatically marked as `completed`.

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

The first thing I would improve is the production-readiness of metrics ingestion.

I would move ingestion to a background job system with retries, explicit ingestion-run records, structured failure reporting, and handling for external API rate limits and transient failures.

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
- Vitest: 14/14 tests passing
- Production build: passing
