# MergeFlow — Project Overview

> **Status:** Final
> **Author:** Engineering Team
> **Created:** 2026-07-05
> **Last Updated:** 2026-07-05
> **Document ID:** `docs/00-project-overview.md`

---

## Table of Contents

1. [Vision](#1-vision)
2. [Problem](#2-problem)
3. [Solution](#3-solution)
4. [Target Users](#4-target-users)
5. [Engineering Principles](#5-engineering-principles)
6. [Core Features](#6-core-features)
7. [MVP Scope](#7-mvp-scope)
8. [Non-Goals](#8-non-goals)
9. [Constraints](#9-constraints)
10. [Future Scope](#10-future-scope)
11. [Success Metrics](#11-success-metrics)
12. [Key Assumptions](#12-key-assumptions)
13. [Specification-Driven Development Lifecycle](#13-specification-driven-development-lifecycle)
14. [Architecture Decision Records](#14-architecture-decision-records)
15. [Glossary](#15-glossary)

---

## 1. Vision

MergeFlow is an AI-powered engineering workspace that augments software engineers
by providing intelligent analysis of pull requests.

The platform connects to GitHub, synchronizes pull request activity, and uses AI
to generate summaries and risk assessments — giving engineers better context
before they begin reviewing code.

**The AI augments engineers. It never replaces them.**

MergeFlow does not make decisions for engineers. It surfaces information that
helps engineers make better decisions faster. The human always has the final word.

---

## 2. Problem

### 2.1 The Pull Request Bottleneck

Code review is one of the highest-leverage activities in software engineering.
It catches bugs, shares knowledge, and maintains code quality. But it has
systemic problems:

| Problem | Impact |
|---------|--------|
| **Context switching cost** | Engineers must stop their own work, read the diff, understand the intent, trace through dependencies, and build a mental model before they can review. This takes 15–45 minutes per PR. |
| **Inconsistent review depth** | Under time pressure, engineers skim large PRs. Critical changes in configuration files, database migrations, or authentication logic get buried in noise. |
| **No risk visibility** | Teams have no systematic way to identify which PRs carry the highest risk. A 5-line change to an auth middleware is more dangerous than a 500-line UI refactor, but nothing surfaces this. |
| **Lost institutional knowledge** | Review feedback lives in GitHub comments. There is no structured history that captures patterns — which files cause the most issues, which types of changes introduce regressions, or how risk evolves over time. |
| **Review fatigue** | High-volume teams face PR queues that grow faster than reviewers can process them, leading to rubber-stamping or delayed merges. |

### 2.2 The Market Gap

Existing solutions in this space fall into two categories:

**Line-level code analysis tools** focus on generating inline code suggestions
and comments. They operate at the level of individual lines of code. They do not
provide engineering-level risk assessment, structured PR comprehension, or
historical review analysis.

**Project management tools** track issues and workflows. They do not integrate
with pull request content and cannot analyze code changes.

The gap is not "AI that writes code review comments."

The gap is **structured, AI-powered engineering intelligence at the pull request
level** — a system that helps engineers understand, prioritize, and contextualize
code changes before they begin reviewing.

MergeFlow occupies this gap.

---

## 3. Solution

MergeFlow provides three capabilities:

### 3.1 Automated PR Comprehension

When a pull request is synchronized from GitHub, MergeFlow uses AI to generate
a **structured summary**: what the PR does, which areas of the codebase it
touches, and what the intent appears to be. The summary is written for a reviewer
who has not yet read the diff.

### 3.2 Engineering Risk Assessment

MergeFlow generates a **structured engineering risk assessment** for each pull
request. The risk assessment provides a categorical signal (Low / Medium / High /
Critical) that helps engineers prioritize their review queue and calibrate their
review depth.

The specific methodology, dimensions, and scoring approach for the risk
assessment are defined in [`docs/08-ai-system.md`](./08-ai-system.md).

### 3.3 Engineering Intelligence Dashboard

A working surface that presents:

- Pull requests organized by risk level
- AI-generated summaries at a glance
- Review history for each PR
- Repository-level activity overview

In the MVP, this is a **working surface** — a place where an engineer starts
their review workflow. It is not an analytics platform.

---

## 4. Target Users

### 4.1 Primary Users (MVP)

| Persona | Description | Core Need |
|---------|-------------|-----------|
| **Individual Developer** | A software engineer working on a team of 1–5. Reviews PRs daily. Wants to reduce context-switching cost. | "Show me what this PR does and whether I should worry about it, before I read the diff." |
| **Startup Engineer** | Works on a small team (2–20). Wears many hats. Does not have time for deep reviews on every PR. | "Help me prioritize which PRs need careful review and which are safe to approve quickly." |

### 4.2 Secondary Users (Future)

| Persona | Description | Core Need |
|---------|-------------|-----------|
| **Engineering Lead** | Manages 5–20 engineers. Needs visibility across all PRs in the team. | "Show me the risk profile of what my team is shipping this week." |
| **Engineering Organization** | 20–100+ engineers. Multiple teams, multiple repos. | "Give me org-level engineering intelligence." |

### 4.3 User Progression

```
Individual Developer
        │
        ▼
Small Team (2–20)        ← MVP optimizes here
        │
        ▼
Engineering Organization  ← Future: requires multi-tenancy, RBAC, org-level views
```

The MVP optimizes for individuals and small teams. Individual users have the
lowest onboarding friction. If the product is valuable for one engineer, it will
spread to their team organically.

---

## 5. Engineering Principles

These principles govern every architectural and implementation decision in
MergeFlow. Every subsequent design document must adhere to them. If a decision
conflicts with a principle, the conflict must be explicitly documented and
justified.

| # | Principle | What It Means |
|---|-----------|--------------|
| P1 | **AI augments engineers, never replaces them** | The AI provides information and analysis. Humans make every engineering decision. MergeFlow never takes autonomous action on a repository. |
| P2 | **Humans make final engineering decisions** | No automated merges, no automated approvals, no automated code changes. Every action that modifies a repository requires explicit human intent. |
| P3 | **Simplicity over unnecessary complexity** | Prefer the simpler solution when two approaches solve the same problem. Complexity must be justified by a concrete requirement, not a hypothetical future need. |
| P4 | **Modular architecture with clear domain boundaries** | Each domain (authentication, repositories, pull requests, AI) is a self-contained module with a well-defined interface. Modules communicate through explicit contracts, not implicit dependencies. |
| P5 | **Provider-agnostic AI integration** | The AI layer abstracts the underlying provider. Business logic never depends on a specific AI vendor's API, data format, or capabilities. Switching providers must not require changes outside the AI module. |
| P6 | **Design for extension, not prediction** | The architecture makes it easy to add new capabilities in the future. It does not contain abstractions, tables, or interfaces that exist solely to anticipate features we may never build. |
| P7 | **Specification before implementation** | No code is written until the relevant architectural decisions have been documented and reviewed. Implementation follows design, not the other way around. |
| P8 | **Explicit ownership and low coupling** | Every piece of data, every behavior, and every side effect has a single owning module. Modules do not reach into each other's internals. Dependencies flow in one direction. |
| P9 | **Production-grade thinking** | Even though this is a learning project, every decision is made as if this system will serve real users at scale. Architecture, error handling, security, and observability are first-class concerns, not afterthoughts. |

---

## 6. Core Features

The following features define MergeFlow as a product. Not all are in the MVP.

| # | Feature | Description |
|---|---------|-------------|
| F1 | **GitHub Authentication** | Sign in with GitHub OAuth. No email/password. |
| F2 | **Repository Connection** | Select and connect GitHub repositories to MergeFlow. |
| F3 | **Pull Request Synchronization** | Synchronize open and recently closed pull requests from connected repositories. |
| F4 | **AI PR Summary** | Generate a structured, human-readable summary of each pull request using AI. |
| F5 | **AI Risk Assessment** | Assign a categorical risk level to each PR based on structured engineering analysis. |
| F6 | **Review History** | Persist every AI-generated review. Allow users to view the review history for any PR. |
| F7 | **Dashboard** | A working surface that displays PRs organized by risk, summaries at a glance, and repository activity. |
| F8 | **Real-Time Synchronization** | Receive updates from GitHub when PRs are opened, updated, or closed. *(Future)* |
| F9 | **Team Views** | Aggregate PR activity across team members. *(Future)* |
| F10 | **Trend Analytics** | Historical analysis of risk patterns, review velocity, and code quality trends. *(Future)* |

---

## 7. MVP Scope

The MVP is the smallest version of MergeFlow that delivers the core value
proposition: **AI-powered pull request understanding.**

### 7.1 MVP Features

| Feature | Included | Rationale |
|---------|----------|-----------|
| GitHub OAuth (F1) | ✅ | Required for any GitHub integration. |
| Repository Connection (F2) | ✅ | Users must select which repos to analyze. |
| Pull Request Sync (F3) | ✅ | Without PR data, there is nothing to analyze. |
| AI PR Summary (F4) | ✅ | Core value proposition. |
| AI Risk Assessment (F5) | ✅ | Core differentiator. |
| Review History (F6) | ✅ | Without persistence, the product has no memory. |
| Dashboard (F7) | ✅ | Without a UI, there is no product. |
| Real-Time Sync (F8) | ❌ | Deferred to Phase 2. |
| Team Views (F9) | ❌ | Requires organization model. |
| Trend Analytics (F10) | ❌ | Requires sufficient historical data. |

The GitHub synchronization strategy (polling vs. webhooks vs. hybrid) will be
evaluated during the System Architecture phase based on architectural tradeoffs.
See [`docs/03-system-architecture.md`](./03-system-architecture.md) and
[ADR-006](#14-architecture-decision-records).

### 7.2 MVP Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                        MergeFlow MVP                        │
│                                                             │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────────┐    │
│  │  GitHub   │   │   Repo   │   │    Pull Request      │    │
│  │  Auth     │──▶│  Connect │──▶│    Synchronization   │    │
│  └──────────┘   └──────────┘   └──────────┬───────────┘    │
│                                            │                │
│                                            ▼                │
│                                 ┌──────────────────────┐    │
│                                 │    AI Analysis        │    │
│                                 │  • Summary Generation │    │
│                                 │  • Risk Assessment    │    │
│                                 └──────────┬───────────┘    │
│                                            │                │
│                                            ▼                │
│                                 ┌──────────────────────┐    │
│                                 │   Review Storage      │    │
│                                 │   + Dashboard         │    │
│                                 └──────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 What "Done" Looks Like for the MVP

A user should be able to:

1. Sign in with their GitHub account.
2. See a list of their GitHub repositories.
3. Connect one or more repositories.
4. See pull requests from those repositories synchronized into MergeFlow.
5. Trigger AI analysis on a pull request.
6. Read an AI-generated summary and risk assessment.
7. View the history of AI reviews for any PR.
8. See a dashboard showing all PRs organized by risk level.

If a user can complete this flow end-to-end, the MVP is complete.

---

## 8. Non-Goals

The following are explicitly out of scope for the MVP. They will not be designed,
architected, or implemented. Some may appear in future iterations.

| Non-Goal | Reason |
|----------|--------|
| Code generation | MergeFlow analyzes code. It does not write code. |
| AI-assisted code editing | The AI reads and summarizes. It does not modify. |
| Merge automation | Engineers decide when to merge. The AI does not. |
| CI/CD execution | MergeFlow is not a CI/CD platform. |
| Issue tracking | Out of scope. Existing tools serve this well. |
| Team collaboration | Requires organization model and RBAC. |
| Notifications | Adds significant infrastructure complexity. |
| Billing | No monetization in MVP. |
| Enterprise RBAC | Requires organization model. |
| Multi-agent AI workflows | Adds complexity without clear MVP value. |
| Vector databases / RAG | PR diffs fit within modern LLM context windows. |
| Enterprise SSO (SAML/OIDC) | GitHub OAuth is sufficient for MVP users. |

---

## 9. Constraints

The following constraints bound the MVP architecture. They exist to prevent
scope creep and architectural drift. Any deviation must be documented in an
Architecture Decision Record.

| ID | Constraint | Implication |
|----|-----------|-------------|
| C1 | **GitHub is the only supported SCM provider** | The integration layer may be designed for extensibility, but only the GitHub implementation exists. No abstraction without a second concrete use case. |
| C2 | **Single-tenant architecture** | No organization model, no multi-user data isolation, no shared tenancy. The schema should not prevent future multi-tenancy, but it must not be designed around it. |
| C3 | **PostgreSQL is the only persistence layer** | No Redis, no message queues, no object storage, no search indices in the MVP. If caching is needed, it happens in-process. |
| C4 | **One active AI provider at runtime** | The AI abstraction supports multiple providers, but only one is configured and active at any given time. No fan-out, no ensemble, no A/B testing. |
| C5 | **No enterprise RBAC** | Users own their own data. There is no concept of organizations, teams, roles, or permissions beyond "authenticated user." |
| C6 | **No billing or monetization** | No payment processing, subscription management, or usage metering. |
| C7 | **No distributed services** | The MVP runs as a single deployable unit. No microservices, no service mesh, no inter-service communication. |
| C8 | **No background processing assumptions** | Whether background workers, queues, or scheduled jobs are needed will be determined during the architecture review. See [ADR-007](#14-architecture-decision-records). |

---

## 10. Future Scope

These features are intentionally deferred. The architecture should not prevent
their future implementation, but it should not be designed around them either.

| Phase | Features | Architectural Prerequisite |
|-------|----------|---------------------------|
| **Phase 2** | Real-time synchronization | Synchronization strategy finalized (ADR-006) |
| **Phase 2** | Notification system | Event-driven patterns |
| **Phase 3** | Organization model | Multi-tenancy, RBAC, data isolation (ADR-008) |
| **Phase 3** | Team dashboards | Organization model |
| **Phase 4** | Trend analytics | Sufficient historical data, time-series queries |
| **Phase 4** | Multi-provider AI evaluation | A/B testing framework |
| **Phase 5** | Enterprise features | SSO, audit logs, compliance, billing |

---

## 11. Success Metrics

Success is measured on three axes: **product functionality**, **engineering
quality**, and **architectural integrity**.

### 11.1 Product Functionality

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **End-to-end flow** | A user can complete the full MVP flow | Manual walkthrough of the 8 steps in §7.3 |
| **AI review quality** | Summaries are accurate and risk levels are reasonable | Manual evaluation against 10 known PRs |
| **Response time** | Dashboard loads in < 2 seconds, AI review completes in < 30 seconds | Manual timing or basic instrumentation |
| **Data integrity** | PR data matches GitHub source of truth | Compare MergeFlow data against GitHub API responses |

### 11.2 Engineering Quality

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Modularity** | Every domain is independently modifiable | Can you change one module without modifying another? |
| **Test coverage** | Critical paths have integration tests | Auth flow, PR sync, AI review pipeline |
| **Deployment readiness** | The application can be deployed to a cloud provider | Build succeeds, configuration is externalized |
| **Clean boundaries** | No circular dependencies between modules | Static analysis or manual dependency graph |
| **Documentation** | Every architectural decision is documented | This document set exists and is current |

### 11.3 Architecture Success Criteria

These criteria validate that the architecture supports future growth without
requiring fundamental restructuring.

| Criteria | Validation |
|----------|------------|
| **AI providers can be replaced without changing business logic** | Swap the AI provider configuration. No changes required in the PR, repository, or dashboard modules. |
| **Repository providers can be added in the future** | The integration boundary is clear enough that a GitLab adapter could be built without modifying existing GitHub logic. |
| **Authentication remains isolated from domain logic** | The auth module handles session and identity. Domain modules receive a verified user identity, never raw tokens or OAuth details. |
| **Repository synchronization is isolated** | The sync process can be changed (polling → webhooks → hybrid) without modifying how PRs are stored or analyzed. |
| **Database schema supports future multi-tenancy** | Every user-owned entity includes a user reference. Adding an organization layer does not require restructuring existing tables. |
| **Modules remain loosely coupled** | Removing or replacing any single module does not cascade failures into other modules. |
| **Architecture supports incremental growth** | New features can be added as new modules without modifying the core. |

---

## 12. Key Assumptions

These assumptions underpin the architecture. If any prove false, the affected
design documents must be revisited.

| ID | Assumption | Risk if False |
|----|-----------|---------------|
| A1 | GitHub is the only VCS provider in the MVP. | The integration layer must be abstracted to support additional providers. |
| A2 | PR diffs fit within LLM context windows (128K–200K tokens). | A chunking or hierarchical summarization strategy is needed. |
| A3 | A single AI provider call per PR review is sufficient. | The AI pipeline must support chaining or multi-pass analysis. |
| A4 | A single database handles all storage needs in the MVP. | Additional data stores may be required. |
| A5 | The user's GitHub token provides sufficient API access. | GitHub App installation tokens may be required for better rate limits and permissions. |

---

## 13. Specification-Driven Development Lifecycle

MergeFlow follows a Specification-Driven Development (SDD) process.
**Implementation does not begin until every relevant architectural decision has
been documented and reviewed.**

```
┌──────────────────────────────────┐
│     1. Project Overview          │  ← You are here
│     (Vision, Scope, Principles)  │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│     2. Product Specification     │
│     (Requirements, User Stories) │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│     3. System Architecture       │
│     (Components, Flows, Risks)   │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│     4. Database Design           │
│     (Entities, Relationships)    │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│     5. Domain Model              │
│     (Business Objects, Rules)    │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│     6. API Design                │
│     (Capabilities, Contracts)    │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│     7–11. Subsystem Design       │
│     (GitHub, AI, Security, etc.) │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│     12. Project Structure        │
│     (Folders, Modules, Standards)│
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│     13. Development Roadmap      │
│     (Milestones, Acceptance)     │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│     Implementation Begins        │
│     (Code follows architecture)  │
└──────────────────────────────────┘
```

### Process Rules

1. **Each document is reviewed and approved before the next begins.**
   No skipping ahead. No parallel document creation.

2. **Architecture Decision Records are created when decisions are made.**
   ADRs are living documents. They are written when the decision is reached,
   not retroactively.

3. **Implementation follows the Development Roadmap.**
   Each milestone maps to documented architecture. The developer implements
   against the specification, not from intuition.

4. **If a decision changes, the affected documents are updated.**
   Downstream documents that depend on a changed decision must be reviewed
   for consistency.

---

## 14. Architecture Decision Records

The following ADRs will be created as decisions are reached during the design
process. Each ADR documents the context, options considered, decision made,
and consequences.

| ADR | Title | Status | Resolved In |
|-----|-------|--------|-------------|
| ADR-001 | Overall System Architecture | 🔲 Pending | `docs/03-system-architecture.md` |
| ADR-002 | Database Design | 🔲 Pending | `docs/04-database-design.md` |
| ADR-003 | Authentication Strategy | 🔲 Pending | `docs/03-system-architecture.md` |
| ADR-004 | GitHub Integration Strategy | 🔲 Pending | `docs/07-github-integration.md` |
| ADR-005 | AI Provider Abstraction | 🔲 Pending | `docs/08-ai-system.md` |
| ADR-006 | Synchronization Strategy | 🔲 Pending | `docs/07-github-integration.md` |
| ADR-007 | Background Processing | 🔲 Pending | `docs/09-background-processing.md` |
| ADR-008 | Multi-tenancy Strategy | 🔲 Pending | `docs/03-system-architecture.md` |

ADRs are stored in `docs/decisions/` and follow this structure:

```
## Context
What is the situation? What forces are at play?

## Problem
What specific decision needs to be made?

## Options
What alternatives were considered?

## Decision
What was decided and why?

## Consequences
What are the implications? What becomes easier? What becomes harder?
```

---

## 15. Glossary

| Term | Definition |
|------|------------|
| **Pull Request (PR)** | A GitHub mechanism for proposing changes to a codebase. Contains a diff, metadata, comments, and review status. |
| **AI Review** | The output of MergeFlow's AI analysis pipeline: a structured summary and a risk assessment for a single PR. |
| **Risk Level** | A categorical assessment (Low / Medium / High / Critical) of the engineering risk associated with a PR. |
| **Repository Connection** | The act of selecting a GitHub repository to be monitored by MergeFlow. |
| **PR Sync** | The process of fetching PR data from GitHub and storing it in MergeFlow's database. |
| **Review History** | The collection of all AI reviews generated for a given PR over time. |
| **Blast Radius** | The extent to which a code change can affect other parts of the system. |
| **Provider-Agnostic** | Designed so that the underlying AI service can be changed without modifying business logic. |
| **SDD** | Specification-Driven Development. Architecture is finalized before implementation begins. |
| **ADR** | Architecture Decision Record. A document capturing a single architectural decision, its context, and its consequences. |

---

*This document is the canonical foundation for every subsequent design document.
All architectural decisions must trace back to the vision, scope, principles,
and constraints defined here.*

*Next document: [`docs/01-product-specification.md`](./01-product-specification.md)*
