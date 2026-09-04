import {
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * ==================================================
 * ENUMS
 * ==================================================
 */

export const userRoleEnum = pgEnum("user_role", ["admin", "creator"]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "active",
  "paused",
  "completed",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "approved",
  "rejected",
  "paid",
]);

/**
 * ==================================================
 * USERS
 * ==================================================
 */

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  email: text("email").notNull().unique(),

  role: userRoleEnum("role").notNull(),
});

/**
 * ==================================================
 * CAMPAIGNS
 * ==================================================
 */

export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),

  title: text("title").notNull(),

  /**
   * Example:
   * ["tiktok", "instagram"]
   */
  platforms: text("platforms").array().notNull(),

  /**
   * Integer cents.
   *
   * Example:
   * 500 = $5.00 per 1,000 views
   */
  payoutPer1kViews: integer("payout_per_1k_views").notNull(),

  /**
   * Integer cents.
   */
  totalBudget: integer("total_budget").notNull(),

  status: campaignStatusEnum("status").notNull().default("draft"),

  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * ==================================================
 * SUBMISSIONS
 * ==================================================
 */

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postUrl: text("post_url").notNull(),
    platform: text("platform").notNull(),
    status: submissionStatusEnum("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    approvedPayout: integer("approved_payout"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    campaignPostUrlUnique: unique("submissions_campaign_post_url_unique").on(
      table.campaignId,
      table.postUrl,
    ),
  }),
);

/**
 * ==================================================
 * SUBMISSION METRICS
 * ==================================================
 */

export const submissionMetrics = pgTable(
  "submission_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, {
        onDelete: "cascade",
      }),

    /**
     * One metric row per submission per day.
     */
    capturedAt: date("captured_at").notNull(),

    views: integer("views").notNull().default(0),

    likes: integer("likes").notNull().default(0),

    comments: integer("comments").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    submissionCapturedAtUnique: unique(
      "submission_metrics_submission_date_unique",
    ).on(table.submissionId, table.capturedAt),
  }),
);

/**
 * ==================================================
 * RELATIONS
 * ==================================================
 */

export const usersRelations = relations(users, ({ many }) => ({
  submissions: many(submissions),
}));

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  submissions: many(submissions),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [submissions.campaignId],
    references: [campaigns.id],
  }),

  creator: one(users, {
    fields: [submissions.creatorId],
    references: [users.id],
  }),

  metrics: many(submissionMetrics),
}));

export const submissionMetricsRelations = relations(
  submissionMetrics,
  ({ one }) => ({
    submission: one(submissions, {
      fields: [submissionMetrics.submissionId],
      references: [submissions.id],
    }),
  }),
);
