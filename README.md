# Clipping Marketplace

A full-stack creator marketplace built as a take-home assignment.

The application allows admins to create and manage campaigns, review creator submissions, approve or reject submissions, and track campaign budgets. Creators can browse active campaigns, submit social media posts, and monitor their submission status and estimated earnings.

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
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

- Campaign list with pagination
- Campaign title search
- Campaign status filtering
- Campaign creation and editing
- Campaign overview
- Submission review
- Approve/reject workflow
- Budget tracking
- Approved views and earnings
- Daily views chart
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

The ingestion process is idempotent, keeps views monotonic, maintains one metric per submission/day, and isolates failures between submissions.

### Budget Safety

Submission approval is performed inside a database transaction with a row lock on the campaign.

This serializes concurrent approvals for the same campaign and prevents approved payouts from exceeding the available campaign budget.

The payout formula is:

```text
floor(views / 1000) * payout_per_1k_views
```

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

Create a local `.env` file with the database connection string expected by the application and Drizzle configuration.

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

The application uses signed cookie authentication with a development-only user switcher instead of a production authentication provider.

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

The project includes tests covering:

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

## Database

Drizzle migrations are committed under:

```text
drizzle/
```

PostgreSQL can be started locally using the included Docker Compose configuration.

## Documentation

Additional implementation notes, including the concurrent approval strategy, access-control decisions, intentional omissions, future improvements, and AI tooling usage are available in:

```text
NOTES.md
```

## Intentional Scope

This project intentionally does not include:

- Production authentication
- Real social-media API integrations
- Real payment processing
- Background job infrastructure
- Notifications
- Fraud detection
- Production moderation workflows

These were kept outside the scope of the take-home implementation so the core marketplace and budget-safety flows could remain focused and testable.
