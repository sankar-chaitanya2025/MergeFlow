import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTableCreator,
  primaryKey,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { type AdapterAccount } from "next-auth/adapters";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `mergeflow_${name}`);

export const posts = createTable(
  "post",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }),
    createdById: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("created_by_idx").on(t.createdById),
    index("name_idx").on(t.name),
  ],
);

export const users = createTable("user", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull(),
  emailVerified: d
    .timestamp({
      mode: "date",
      withTimezone: true,
    })
    .$defaultFn(() => /* @__PURE__ */ new Date()),
  image: d.varchar({ length: 255 }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  repositories: many(repositories),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [index("t_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const repositories = createTable(
  "repository",
  (d) => ({
    id: d
      .varchar("id", { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    githubRepoId: d.varchar("github_repo_id", { length: 255 }).notNull(),
    fullName: d.varchar("full_name", { length: 255 }).notNull(),
    owner: d.varchar("owner", { length: 255 }).notNull(),
    name: d.varchar("name", { length: 255 }).notNull(),
    isPrivate: d.boolean("is_private").notNull().default(false),
    language: d.varchar("language", { length: 255 }),
    connectionStatus: d.varchar("connection_status", { length: 255 }).notNull().default("CONNECTED"),
    connectedAt: d
      .timestamp("connected_at", { withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    lastSyncedAt: d.timestamp("last_synced_at", { withTimezone: true }),
  }),
  (t) => [
    unique("user_repo_unique_idx").on(t.userId, t.githubRepoId),
    index("repo_user_id_status_idx").on(t.userId, t.connectionStatus),
  ],
);

export const repositoriesRelations = relations(repositories, ({ one, many }) => ({
  user: one(users, { fields: [repositories.userId], references: [users.id] }),
  pullRequests: many(pullRequests),
}));

export const pullRequests = createTable(
  "pull_request",
  (d) => ({
    id: d
      .varchar("id", { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    repositoryId: d
      .varchar("repository_id", { length: 255 })
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    githubPrNumber: d.integer("github_pr_number").notNull(),
    title: d.varchar("title", { length: 255 }).notNull(),
    authorUsername: d.varchar("author_username", { length: 255 }).notNull(),
    status: d.varchar("status", { length: 255 }).notNull(),
    sourceBranch: d.varchar("source_branch", { length: 255 }).notNull(),
    targetBranch: d.varchar("target_branch", { length: 255 }).notNull(),
    linesAdded: d.integer("lines_added").notNull(),
    linesRemoved: d.integer("lines_removed").notNull(),
    filesChanged: d.integer("files_changed").notNull(),
    githubCreatedAt: d.timestamp("github_created_at", { withTimezone: true }).notNull(),
    githubUpdatedAt: d.timestamp("github_updated_at", { withTimezone: true }).notNull(),
    githubMergedAt: d.timestamp("github_merged_at", { withTimezone: true }),
    syncedAt: d
      .timestamp("synced_at", { withTimezone: true })
      .notNull()
      .$defaultFn(() => /* @__PURE__ */ new Date()),
  }),
  (t) => [
    unique("repo_pr_number_unique_idx").on(t.repositoryId, t.githubPrNumber),
    index("pr_repo_id_status_idx").on(t.repositoryId, t.status),
    index("pr_github_updated_at_idx").on(t.githubUpdatedAt),
  ],
);

export const pullRequestsRelations = relations(pullRequests, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [pullRequests.repositoryId],
    references: [repositories.id],
  }),
  reviews: many(reviews),
}));

export const reviews = createTable(
  "review",
  (d) => ({
    id: d
      .varchar("id", { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pullRequestId: d
      .varchar("pull_request_id", { length: 255 })
      .notNull()
      .references(() => pullRequests.id, { onDelete: "cascade" }),
    riskLevel: d.varchar("risk_level", { length: 255 }).notNull(),
    summary: d.text("summary").notNull(),
    riskReasoning: d.text("risk_reasoning").notNull(),
    aiProvider: d.varchar("ai_provider", { length: 255 }).notNull(),
    modelVersion: d.varchar("model_version", { length: 255 }).notNull(),
    metadata: d.jsonb("metadata"),
    createdAt: d
      .timestamp("created_at", { withTimezone: true })
      .notNull()
      .$defaultFn(() => /* @__PURE__ */ new Date()),
  }),
  (t) => [
    index("review_pr_id_created_at_idx").on(t.pullRequestId, t.createdAt),
  ]
);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  pullRequest: one(pullRequests, {
    fields: [reviews.pullRequestId],
    references: [pullRequests.id],
  }),
}));
