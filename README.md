# MergeFlow

AI-powered engineering intelligence for pull requests — structured summaries, risk assessments, and immutable review history that help engineers understand code changes before they read the diff.

---

## Why MergeFlow Exists

Code review is one of the highest-leverage activities in software engineering. It catches bugs, transfers knowledge, and maintains quality. But it has a structural problem: the reviewer must context-switch away from their own work, read an unfamiliar diff, build a mental model of intent, trace through affected dependencies, and then make a judgment call about risk — all before writing a single comment.

This takes 15–45 minutes per pull request. For teams processing 10–20 PRs per day, that is a significant fraction of engineering bandwidth spent on orientation, not on actual review.

Existing tools in this space fall into two categories: **line-level code analysis** (tools that suggest inline fixes) and **project management** (tools that track issues and workflows). Neither provides what a reviewer actually needs before they start: a structured understanding of what the PR does, what areas it touches, and whether it is dangerous.

MergeFlow occupies the gap between those categories. It reads a pull request and produces a structured engineering review — a summary, a categorical risk assessment (Low / Medium / High / Critical), and a brief reasoning for the risk judgment. The AI augments the reviewer. It never replaces them.

---

## The Problem

A 5-line change to an authentication middleware is more dangerous than a 500-line UI refactor. But nothing in the standard GitHub workflow surfaces this distinction. Both PRs appear in the same queue, with the same visual weight, and the same expectation of review depth.

The result is predictable: under time pressure, engineers skim large PRs and rubber-stamp small ones. Critical changes in configuration files, database migrations, and security logic get buried. Review feedback lives in GitHub comments with no structured way to track patterns — which files cause issues, which types of changes introduce regressions, or how risk evolves over time.

MergeFlow was built to solve this. Not by replacing reviewers, but by giving them the context they need to make better prioritization decisions before they open the diff.

---

## The Solution

MergeFlow connects to a developer's GitHub account, synchronizes their pull request activity, and uses an LLM to generate structured engineering reviews. Each review produces a JSON object with a technical summary, a categorical risk level, and a brief justification. Reviews are immutable — re-analyzing a PR creates a new record, preserving a complete timeline of how the AI's assessment evolved.

The system was designed using **Specification-Driven Development**. Five architectural documents were written and frozen before a single line of implementation code was committed. The implementation plan maps every functional requirement to a specific vertical slice, and every vertical slice traces back to the architecture. This README explains the engineering decisions that emerged from that process.

---

## Architecture Overview

```
                          ┌─────────────────────┐
                          │   Developer Browser  │
                          └──────────┬──────────┘
                                     │ HTTPS
                          ┌──────────▼──────────┐
                          │   Next.js App Router │
                          │   (Server Components │
                          │    + tRPC API Layer)  │
                          └──────────┬──────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
   ┌────────▼────────┐    ┌─────────▼─────────┐    ┌────────▼────────┐
   │  GitHub REST API │    │    PostgreSQL      │    │  AI Provider    │
   │  (OAuth, Repos,  │    │  (Users, Repos,    │    │  (OpenAI API)   │
   │   PRs, Diffs)    │    │   PRs, Reviews)    │    │                 │
   └─────────────────┘    └───────────────────┘    └─────────────────┘
```

The system is a monolith by design (ADR-001). All domain logic, API endpoints, background processing, and server-rendered UI live in a single deployable unit. The domain boundaries are strict enough that any module could be extracted into a service — the interfaces would become service contracts — but there is no reason to pay the operational cost of distribution for an MVP targeting individual developers.

---

## Complete Workflow

The system implements a linear pipeline from authentication to dashboard analytics. Each stage was built as an independent vertical slice with its own schema migration, business logic, API endpoints, and UI.

**1. GitHub OAuth Authentication** — The user signs in with GitHub. Auth.js handles the OAuth flow, persists user identity via the Drizzle adapter, and stores the GitHub access token in the database. The session is server-side (database-backed, not JWT), making it immediately revocable.

**2. Repository Discovery** — The server uses the stored access token to call `GET /user/repos` on the GitHub API. The response is merged with the user's existing database records to display connection status alongside each repository.

**3. Repository Connection** — The user selects repositories to monitor. Connection is an idempotent UPSERT — if the repository was previously disconnected, reconnecting it flips the `connection_status` back to `CONNECTED` without creating a duplicate.

**4. Pull Request Synchronization** — The sync engine fetches open PRs and the last N closed/merged PRs for each connected repository. PRs are persisted using `ON CONFLICT DO UPDATE` keyed on `(repository_id, github_pr_number)`, making the operation strictly idempotent. Each repository is synced inside its own database transaction to isolate failure domains — if one repository fails, the others are unaffected.

**5. AI Review Generation** — The user triggers analysis on a specific PR. The system loads the PR context, constructs a structured prompt, sends it to the configured AI provider (OpenAI), and receives a JSON response. The response is parsed with `JSON.parse`, then validated against a Zod schema that enforces the exact shape: `{ summary, riskLevel, riskReasoning, metadata }`. If validation fails, the review is rejected entirely — no partial data is persisted.

**6. Review Persistence** — The validated review is inserted as a new row in the `reviews` table. The table is append-only by design: there is no `UPDATE` operation, no `updatedAt` column, and no `DELETE` path. Re-analyzing a PR always creates a new record.

**7. Review History** — All reviews for a PR are returned in reverse chronological order. The latest review is visually highlighted in the timeline UI. Because the table is append-only, "history" is not a feature that needed to be engineered — it falls out of the schema naturally.

**8. Dashboard Analytics** — The dashboard aggregates metrics across all connected repositories using five parallel SQL queries with `GROUP BY`, `COUNT`, and `JOIN`. No N+1 queries. The entire dashboard is a Next.js Server Component — zero client-side JavaScript is required to render it.

---

## Engineering Decisions

### Specification-Driven Development

The architecture was fully specified before implementation began. Five documents — [Project Overview](docs/00-project-overview.md), [Product Specification](docs/01-product-specification.md), [Domain Analysis](docs/02-domain-analysis.md), [System Architecture](docs/03-system-architecture.md), and [Database Design](docs/04-database-design.md) — define the domain boundaries, entity lifecycles, communication contracts, failure isolation matrix, and trust boundaries.

Implementation followed the specification. When a design question arose during coding, the answer was looked up in the architecture, not improvised. This eliminated architectural drift and ensured that every module's boundaries were respected throughout the build.

**Tradeoff:** SDD front-loads significant design work. For a solo developer, this meant spending time on documents before writing any code. The payoff was that implementation was mechanical — each milestone had clear inputs, outputs, and acceptance criteria. There was no ambiguity about what to build or how modules should interact.

### Append-Only Reviews

The `reviews` table has no `updatedAt` column, no `UPDATE` queries, and no `DELETE` operations. Every AI analysis creates a new immutable row. This was a deliberate architectural choice documented in the product specification (DD-4, INV-8, BR-4).

**Why this matters:** Pull requests evolve. New commits are pushed, branches are rebased, files are added. An AI review corresponds to a specific snapshot of the PR at the time of analysis. If you overwrite the review when re-analyzing, you lose the record of what the AI said about the previous version. For an engineering tool focused on risk visibility, losing historical data defeats the purpose.

**Why naive approaches fail:** The obvious implementation is a single `review` row per PR with an `UPDATE` on re-analysis. This is simpler to query (no "latest" logic needed) but destroys the audit trail. A soft-delete or versioning scheme adds complexity without the simplicity benefit of append-only.

**How MergeFlow solves it:** New row on every analysis. "Latest" is `ORDER BY created_at DESC LIMIT 1`, which hits the composite index `(pull_request_id, created_at)` directly. History is just removing the `LIMIT`.

### AI Provider Abstraction (Anti-Corruption Layer)

The AI module is structured as five files with strict responsibilities:

```
src/server/ai/
├── provider.ts    # Interface: AIProvider { name, model, generateStructuredReview() }
├── openai.ts      # Concrete: OpenAI REST API implementation
├── prompt.ts      # Pure function: buildReviewPrompt(context) → string
├── schema.ts      # Zod schema: ReviewResponseSchema
└── review.ts      # Orchestrator: prompt → provider → parse → validate → DTO
```

The tRPC router knows nothing about OpenAI, prompt construction, or JSON parsing. It calls `generatePullRequestReview(context)` and receives a validated DTO or an error. This is the Anti-Corruption Layer pattern from the domain analysis (DI-V3, DI-V4): the external AI provider's response format is translated into the application's domain model before it crosses the trust boundary.

**Why this matters:** LLM responses are structurally unpredictable. The model might return valid JSON with wrong keys, hallucinate enum values (`"MODERATE"` instead of `"MEDIUM"`), wrap the response in markdown code blocks, or return a completely unrelated format. The Zod validation layer (`ReviewResponseSchema.safeParse()`) rejects any response that doesn't exactly match the expected shape. If validation fails, no review is persisted — the system maintains data integrity by treating the AI's output as untrusted until proven otherwise.

**Tradeoff:** Strict validation means some valid-but-differently-formatted AI responses are rejected. A more permissive approach (fuzzy matching, fallback parsing) would accept more responses but risks persisting malformed data. For an engineering tool, data integrity was prioritized over acceptance rate.

### Idempotent Synchronization

PR synchronization uses `ON CONFLICT DO UPDATE` keyed on the unique constraint `(repository_id, github_pr_number)`. Running the sync twice with the same GitHub data produces exactly the same database state. This satisfies DI-P2 (sync idempotency) from the domain analysis.

**Why this matters:** Network failures, timeouts, and user impatience (clicking "Sync" twice) are inevitable. Without idempotency, each retry could create duplicate PR records, corrupt metrics, and break foreign key relationships with the reviews table.

**Implementation detail:** Each repository's PRs are synced inside an independent database transaction. If repository A syncs successfully but repository B fails (e.g., GitHub returns a 403 for a private repo the user lost access to), repository A's data is committed and B's failure is logged without rolling back the entire batch. The sync result DTO reports inserted/updated counts and a list of failed repositories with error messages.

### Server-Side Rendering with Server Components

The dashboard, review history, and repository management pages are all Next.js Server Components. Data fetching happens on the server via tRPC server-side callers. The HTML is fully rendered before it reaches the browser.

**Why this matters:** The dashboard performs five aggregation queries with `JOIN`, `GROUP BY`, and `COUNT`. If these ran client-side, the browser would need to fetch raw data, wait for multiple round trips, and then compute the aggregations in JavaScript. By executing everything on the server, the client receives pre-rendered HTML with zero layout shift and near-instant Time-to-Interactive.

**Tradeoff:** Server Components cannot use React hooks, browser APIs, or client-side state. Interactive elements (like the repository connection toggle) are implemented as separate Client Components. This split adds architectural overhead but the performance gain for a data-heavy dashboard is significant.

### tRPC over REST

The API uses tRPC (ADR-001b) — an RPC-style protocol that provides end-to-end type safety between the server procedures and the React client. Procedures map directly to domain commands and queries from the domain analysis: `syncPullRequests`, `generateReview`, `getDashboardOverview`.

**Tradeoff:** tRPC is not suitable for external API consumers. If MergeFlow ever needs a public API, a REST or GraphQL layer would need to be added on top. For an application where the only consumer is its own UI, the type safety and developer experience benefits outweigh this limitation.

### PostgreSQL with Drizzle ORM

PostgreSQL was the only persistence layer (constraint C3). Drizzle was chosen over Prisma for its SQL-first approach — the dashboard aggregation queries use `sql` template literals for `COUNT(DISTINCT ...)` and `GROUP BY`, which would be difficult or impossible to express in Prisma's query builder.

All tables use a `mergeflow_` prefix via Drizzle's multi-project schema feature, allowing the database to be shared with other applications without namespace collisions.

---

## Challenges Faced During Development

### Validating Stochastic AI Output

**Problem:** LLMs are stochastic text generators. Even with `response_format: { type: "json_object" }` and `temperature: 0.2`, the model can return subtly wrong structures — inventing keys, changing casing, omitting fields, or wrapping JSON in markdown code blocks.

**Why it is difficult:** You cannot write unit tests against an LLM's output because the output is non-deterministic. Traditional input validation assumes the data source is a structured system (a database, an API with a schema). LLMs have no schema contract.

**Solution:** Three-layer validation in `src/server/ai/review.ts`:
1. `JSON.parse()` — catches syntactically invalid JSON (markdown-wrapped responses, truncated output).
2. `ReviewResponseSchema.safeParse()` — catches structurally valid JSON that doesn't match the expected shape (wrong keys, wrong enum values).
3. Domain invariant DI-V4 — if either layer fails, no review is persisted. The database remains clean.

**Lesson learned:** Treat LLM output like untrusted user input. The validation layer is not optional — it is the engineering boundary that makes the system reliable.

### Per-Repository Transaction Isolation

**Problem:** Sync fetches PRs from GitHub for multiple repositories. If one repository fails (rate limit, revoked access, network timeout), the entire sync operation should not roll back.

**Why it is difficult:** A single database transaction wrapping all repositories means one failure cascades. But no transaction at all means a partially-failed sync could leave the database in an inconsistent state (some PRs committed, others not).

**Solution:** Each repository is synced inside its own `db.transaction()` block. Success commits the PRs and updates `last_synced_at`. Failure logs the error, adds the repository to the `failedRepositories` list, and moves to the next one. The sync result DTO reports everything: `{ syncedRepositories, syncedPullRequests, inserted, updated, failedRepositories, durationMs }`.

### Dashboard Aggregation Without N+1

**Problem:** The dashboard needs metrics across users, repositories, pull requests, and reviews — four tables deep. A naive implementation fetches all repositories, then loops through each to count PRs, then loops through each PR to count reviews. For 20 repositories with 100 PRs each, this is 2,000+ queries.

**Solution:** Five parallel SQL queries using `Promise.all()`, each performing aggregation natively in PostgreSQL with `INNER JOIN`, `LEFT JOIN`, `GROUP BY`, and `COUNT(DISTINCT ...)`. The dashboard loads with exactly 5 database round trips regardless of data volume. The composite indexes on `(user_id, connection_status)`, `(repository_id, status)`, and `(pull_request_id, created_at)` ensure these queries hit index scans, not sequential scans.

### Authorization Without a Dedicated RBAC System

**Problem:** The `reviews` table has no `user_id` column. Reviews belong to pull requests, which belong to repositories, which belong to users. How do you enforce that User A cannot read User B's reviews without adding a `user_id` to every table?

**Solution:** Authorization traverses the ownership chain. When a user requests a review, the router loads the pull request with its parent repository (via Drizzle's `with: { repository: true }`), then checks `pr.repository.userId === ctx.session.user.id`. This is a two-query pattern (load PR + validate ownership) but it avoids denormalizing `user_id` across every table, which would violate the single-owner principle from the domain analysis.

---

## Tech Stack

| Technology | Role | Why Selected |
|---|---|---|
| **Next.js 15** | Full-stack framework | Server Components for data-heavy pages. App Router for file-based routing. API routes for tRPC endpoints. Single deployable unit satisfies C7. |
| **tRPC** | Type-safe API | End-to-end type inference between server procedures and React client. Procedures map 1:1 to domain commands/queries. |
| **Drizzle ORM** | Database toolkit | SQL-first query builder that doesn't abstract away `JOIN` and `GROUP BY`. Multi-project schema support for table prefixing. |
| **PostgreSQL** | Primary database | Relational integrity via foreign keys and unique constraints. JSONB for extensible metadata. `ON CONFLICT DO UPDATE` for idempotent upserts. |
| **Auth.js (v5)** | Authentication | GitHub OAuth with the Drizzle adapter. Server-side sessions for immediate revocability. |
| **Zod** | Schema validation | Runtime validation of AI output, tRPC input, and environment variables. Single validation library across all trust boundaries. |
| **OpenAI API** | AI provider | `gpt-4o-mini` with `response_format: { type: "json_object" }` for structured output. Abstracted behind the `AIProvider` interface. |
| **Docker** | Containerization | Multi-stage build with Alpine Linux. Non-root user. Standalone Next.js output reduces image size. |
| **GitHub Actions** | CI pipeline | Lint, type-check, format verification, Drizzle schema consistency, and production build on every push. |

---

## Project Structure

```
src/
├── app/                              # Next.js App Router
│   ├── page.tsx                      # Landing page with OAuth sign-in
│   ├── dashboard/
│   │   ├── page.tsx                  # Main dashboard (Server Component)
│   │   ├── repositories/            # Repository management UI
│   │   └── reviews/[pullRequestId]/ # Review history timeline
│   └── api/                         # Auth and tRPC route handlers
│
├── server/
│   ├── ai/                          # AI domain module
│   │   ├── provider.ts              # AIProvider interface
│   │   ├── openai.ts                # OpenAI implementation
│   │   ├── prompt.ts                # Prompt construction
│   │   ├── schema.ts                # Zod output validation
│   │   └── review.ts                # Orchestration layer
│   │
│   ├── api/
│   │   ├── trpc.ts                  # tRPC initialization + middleware
│   │   ├── root.ts                  # Router registry
│   │   └── routers/
│   │       ├── repository.ts        # GitHub integration + connection management
│   │       ├── pull-request.ts      # Sync engine with idempotent upserts
│   │       ├── review.ts            # AI generation + append-only persistence
│   │       └── dashboard.ts         # Aggregation queries
│   │
│   ├── auth/                        # Auth.js configuration
│   └── db/
│       ├── index.ts                 # Database client
│       └── schema.ts                # Drizzle schema (users, repos, PRs, reviews)
│
├── trpc/                            # tRPC client configuration
└── env.js                           # Zod-validated environment variables

docs/
├── 00-project-overview.md           # Vision, principles, constraints
├── 01-product-specification.md      # Functional requirements, user stories
├── 02-domain-analysis.md            # Bounded contexts, aggregates, invariants
├── 03-system-architecture.md        # C4 diagrams, sequence diagrams, ADRs
└── 04-database-design.md            # ERD, table definitions, indexing strategy

IMPLEMENTATION_PLAN.md                # Milestone roadmap with dependency graph
```

---

## Running Locally

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or use the provided `start-database.sh` script to run one via Docker)
- A GitHub OAuth App ([create one here](https://github.com/settings/developers))
- An OpenAI API key

### Setup

```bash
git clone https://github.com/sankar-chaitanya2025/MergeFlow.git
cd MergeFlow
npm install
cp .env.example .env
```

Edit `.env` with your credentials (see [Environment Variables](#environment-variables) below).

```bash
# Push the schema to your database
npx drizzle-kit push

# Start the development server
npm run dev
```

Navigate to `http://localhost:3000`, sign in with GitHub, connect a repository, sync PRs, and trigger an AI review.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string. Use a pooled connection (port 6543) in serverless environments. |
| `AUTH_SECRET` | Production | Session encryption key. Generate with `npx auth secret`. Optional in development. |
| `AUTH_GITHUB_ID` | Yes | GitHub OAuth App Client ID. |
| `AUTH_GITHUB_SECRET` | Yes | GitHub OAuth App Client Secret. |
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI review generation. |

All variables are validated at build time via Zod in `src/env.js`. Missing or malformed values fail the build immediately.

---

## Deployment

### Docker

```bash
docker build -t mergeflow .
docker run -p 3000:3000 --env-file .env mergeflow
```

The Dockerfile uses a three-stage build: `deps` (install dependencies), `builder` (compile Next.js), `runner` (production server). The final image runs as a non-root user on Alpine Linux using Next.js standalone output.

### Vercel

The project is configured for Vercel deployment out of the box (`output: "standalone"` in `next.config.js`). Add all environment variables in the Vercel dashboard. Ensure `AUTH_SECRET` is set for production. Point `DATABASE_URL` to a managed PostgreSQL instance with connection pooling.

**Important:** The `generateReview` mutation calls the OpenAI API, which can take 5–15 seconds. Vercel's default serverless function timeout is 10 seconds on the Hobby plan. You may need the Pro plan for `maxDuration: 60`.

### CI/CD

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and PR to `main`:

1. Install dependencies (`npm ci`)
2. Verify formatting (Prettier)
3. Lint (ESLint)
4. Type check (`tsc --noEmit`)
5. Verify Drizzle schema consistency
6. Build the application

All steps must pass. There is no automatic deployment — builds are verified, deployment is manual.

---

## Future Improvements

These are realistic improvements grounded in the existing architecture, not speculative features.

**Real diff fetching** — The current implementation passes a placeholder diff to the AI. Fetching the actual diff from `GET /repos/{owner}/{repo}/pulls/{number}.diff` and feeding it to the prompt is the single highest-impact improvement.

**Background job processing** — AI analysis currently blocks the HTTP request. The architecture already specifies a `jobs` table (ADR-007) with a `Pending → Running → Completed → Failed` lifecycle. Moving to async execution requires no domain logic changes — only the job dispatcher implementation.

**GitHub webhooks** — The sync engine is trigger-agnostic by design (ADR-006). Adding a webhook endpoint that calls the same `SyncPullRequests` interface would enable real-time PR updates without polling.

**Rate limit awareness** — The GitHub API returns `X-RateLimit-Remaining` headers. Tracking this value and aborting sync early when limits are low would prevent partial failures.

**Multi-provider AI** — The `AIProvider` interface already supports multiple implementations. Adding `AnthropicProvider` or `GeminiProvider` requires implementing `generateStructuredReview()` in a new file. No changes to prompts, validation, or persistence.

---

## Engineering Lessons

**Specification-Driven Development works for solo developers.** The common objection is that SDD is overhead for small teams. In practice, having frozen architecture documents eliminated the most expensive kind of engineering time: deciding what to build while building it. Each milestone was a mechanical execution against a clear specification.

**Append-only tables simplify more than they complicate.** The initial instinct was to use a single updatable review row per PR. The append-only design required slightly more complex "latest" queries but eliminated an entire class of problems: lost history, race conditions on concurrent updates, and audit trail reconstruction.

**Zod at trust boundaries is non-negotiable.** Every boundary where data crosses between systems — browser to server, GitHub to server, AI to server, server to database — benefits from runtime schema validation. Zod serves all four boundaries in this codebase with a single library.

**What would change in V2:** The current authorization pattern (traversing the ownership chain on every request) would not scale to organizations with shared repositories. V2 would introduce a proper RBAC system with cached permission checks. The database schema was designed to support this migration path (ADR-008) without restructuring existing tables.

---

## License

MIT

---

*Built with [T3 Stack](https://create.t3.gg/) — Next.js, tRPC, Drizzle, Auth.js, Tailwind CSS.*
