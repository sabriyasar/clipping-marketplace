# Clipping Marketplace

A full-stack creator marketplace built as a take-home assignment.

The application allows admins to create and manage paid clipping campaigns, review creator submissions, approve or reject submissions, and track campaign budgets. Creators can browse active campaigns, submit social media posts, and monitor submission status and estimated earnings.

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript (strict mode)
- tRPC v11
- Drizzle ORM
- PostgreSQL
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod
- Vitest

## Features

### Admin

- Campaign list with server-side pagination
- Campaign title search
- Campaign status filtering
- Campaign creation and editing
- Campaign overview
- Submission review queue
- Approve/reject workflow
- Budget tracking
- Approved views and current earnings
- Daily views chart across the campaign period
- Automatic campaign completion when the budget is exhausted

### Creator

- Browse active campaigns
- View campaign details
- Submit supported social media post URLs
- Duplicate submission protection
- View personal submissions
- View latest views
- View estimated earnings
- Track submission status

### Metrics Ingestion

The project includes a simulated daily metrics ingestion command:

```bash
pnpm ingest
```

The ingestion process:

- Is idempotent for the same submission/day
- Maintains one metric row per submission/day
- Keeps view counts monotonic
- Processes submissions independently so one failure does not stop the entire run
- Reports failures after the run

### Budget Safety

Submission approval is performed inside a database transaction with a row lock on the campaign.

This serializes concurrent approvals for the same campaign and prevents approved payouts from exceeding the available campaign budget.

The payout formula is:

```text
floor(views / 1000) * payout_per_1k_views
```

All monetary values are stored as integer cents.

## Getting Started

### Requirements

- Node.js 20+
- pnpm
- Docker

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

### 3. Configure environment variables

Create a local `.env.local` file:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/clipping_marketplace"
SESSION_SECRET="your-local-development-secret"
```

Do not commit environment files or secrets to the repository.

For production, configure `DATABASE_URL` and `SESSION_SECRET` through the hosting provider's environment variables.

### 4. Run database migrations

```bash
pnpm drizzle-kit migrate
```

### 5. Seed the database

```bash
pnpm db:seed
```

### 6. Start the development server

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

The application uses signed-cookie authentication with a development-only user switcher instead of a production authentication provider, as requested.

## Development Commands

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm ingest
```

## Tests

The test suite covers the areas most likely to affect correctness:

- Payout calculation
- Campaign budget ceiling
- Concurrent approval behavior
- Submission access control
- Duplicate submission protection
- Metrics ingestion idempotency

Current test status:

```text
14/14 tests passing
```

The full verification command is:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Database

Drizzle migrations are generated with `drizzle-kit` and committed under:

```text
drizzle/
```

PostgreSQL can be started locally using the included Docker Compose configuration.

## Documentation

Additional implementation notes covering:

- Concurrent approval handling
- Payout and budget behavior
- Access-control decisions
- Submission validation
- Metrics ingestion
- Intentional omissions
- Future improvements
- AI tooling usage

are available in:

```text
NOTES.md
```

## Intentional Scope

This project intentionally does not include:

- Production authentication
- Real TikTok, Instagram, or YouTube API integrations
- Real payment processing
- Background job infrastructure
- Notifications
- Creator profiles
- Advanced analytics
- Fraud detection
- Production-grade moderation workflows

These were intentionally kept outside the scope of the take-home assignment so the core marketplace, access-control, ingestion, and budget-safety flows could remain small, focused, and testable.
