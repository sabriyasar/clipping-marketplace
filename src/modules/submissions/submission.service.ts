import { and, desc, eq, sql } from "drizzle-orm";

import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "@/server/trpc/context";

import { campaigns, submissionMetrics, submissions, users } from "@/db/schema";

import type { CreateSubmissionInput } from "./submission.validation";

import { allocateBudget, calculatePayout } from "../campaigns/payout";

type Db = TRPCContext["db"];

function isValidPlatformUrl(
  platform: CreateSubmissionInput["platform"],
  postUrl: string,
) {
  let url: URL;

  try {
    url = new URL(postUrl);
  } catch {
    return false;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  switch (platform) {
    case "tiktok":
      return hostname === "tiktok.com" || hostname.endsWith(".tiktok.com");

    case "instagram":
      return (
        hostname === "instagram.com" || hostname.endsWith(".instagram.com")
      );

    case "youtube":
      return (
        hostname === "youtube.com" ||
        hostname === "youtu.be" ||
        hostname.endsWith(".youtube.com")
      );

    default:
      return false;
  }
}

/**
 * Groups rows by campaign and allocates each campaign's budget across
 * its approved/paid submissions using the shared allocateBudget logic,
 * so displayed earnings here always agree with the campaign overview's
 * "Spent" figure.
 */
function allocateEarningsAcrossCampaigns<
  T extends {
    id: string;
    campaignId: string;
    status: "pending" | "approved" | "rejected" | "paid";
    views: number;
    payoutPer1kViews: number;
    totalBudget: number;
    updatedAt: Date;
  },
>(rows: T[]): Map<string, number> {
  const earningsById = new Map<string, number>();

  const byCampaign = new Map<string, T[]>();

  for (const row of rows) {
    const list = byCampaign.get(row.campaignId) ?? [];
    list.push(row);
    byCampaign.set(row.campaignId, list);
  }

  for (const campaignRows of byCampaign.values()) {
    const firstRow = campaignRows[0];

    if (!firstRow) {
      continue;
    }

    const { totalBudget, payoutPer1kViews } = firstRow;

    const allocated = allocateBudget(
      campaignRows,
      totalBudget,
      payoutPer1kViews,
    );

    for (const [id, payout] of allocated) {
      earningsById.set(id, payout);
    }
  }

  return earningsById;
}

export async function createSubmission(
  db: Db,
  creatorId: string,
  input: CreateSubmissionInput,
) {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, input.campaignId),
  });

  if (!campaign) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Campaign not found",
    });
  }

  if (campaign.status !== "active") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Campaign is not active",
    });
  }

  if (!campaign.platforms.includes(input.platform)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Platform is not supported by this campaign",
    });
  }

  if (!isValidPlatformUrl(input.platform, input.postUrl)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "URL does not match the selected platform",
    });
  }

  const existingSubmission = await db.query.submissions.findFirst({
    where: and(
      eq(submissions.campaignId, input.campaignId),
      eq(submissions.postUrl, input.postUrl),
    ),
  });

  if (existingSubmission) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This URL has already been submitted to this campaign",
    });
  }

  try {
    const [submission] = await db
      .insert(submissions)
      .values({
        campaignId: input.campaignId,
        creatorId,
        postUrl: input.postUrl,
        platform: input.platform,
        status: "pending",
      })
      .returning();

    return submission;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("submissions_campaign_post_url_unique")
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This URL has already been submitted to this campaign",
      });
    }

    throw error;
  }
}

export async function listMySubmissions(db: Db, creatorId: string) {
  const rows = await db
    .select({
      id: submissions.id,
      campaignId: submissions.campaignId,
      campaignTitle: campaigns.title,
      payoutPer1kViews: campaigns.payoutPer1kViews,
      totalBudget: campaigns.totalBudget,
      postUrl: submissions.postUrl,
      platform: submissions.platform,
      status: submissions.status,
      rejectionReason: submissions.rejectionReason,
      createdAt: submissions.createdAt,
      updatedAt: submissions.updatedAt,
      views: sql<number>`coalesce((
        select sm.views
        from submission_metrics sm
        where sm.submission_id = ${submissions.id}
        order by sm.captured_at desc
        limit 1
      ), 0)`,
    })
    .from(submissions)
    .innerJoin(campaigns, eq(submissions.campaignId, campaigns.id))
    .where(eq(submissions.creatorId, creatorId))
    .orderBy(desc(submissions.createdAt));

  const normalizedRows = rows.map((row) => ({
    ...row,
    views: Number(row.views),
  }));

  const earningsById = allocateEarningsAcrossCampaigns(normalizedRows);

  return normalizedRows.map((row) => ({
    ...row,
    earnings: earningsById.get(row.id) ?? 0,
  }));
}

export async function listSubmissionsByCampaign(db: Db, campaignId: string) {
  const rows = await db
    .select({
      id: submissions.id,
      campaignId: submissions.campaignId,
      creatorId: submissions.creatorId,
      creatorEmail: users.email,
      payoutPer1kViews: campaigns.payoutPer1kViews,
      totalBudget: campaigns.totalBudget,
      postUrl: submissions.postUrl,
      platform: submissions.platform,
      status: submissions.status,
      rejectionReason: submissions.rejectionReason,
      createdAt: submissions.createdAt,
      updatedAt: submissions.updatedAt,
      views: sql<number>`coalesce((
        select sm.views
        from submission_metrics sm
        where sm.submission_id = ${submissions.id}
        order by sm.captured_at desc
        limit 1
      ), 0)`,
    })
    .from(submissions)
    .innerJoin(users, eq(submissions.creatorId, users.id))
    .innerJoin(campaigns, eq(submissions.campaignId, campaigns.id))
    .where(eq(submissions.campaignId, campaignId))
    .orderBy(desc(submissions.createdAt));

  const normalizedRows = rows.map((row) => ({
    ...row,
    views: Number(row.views),
  }));

  const earningsById = allocateEarningsAcrossCampaigns(normalizedRows);

  return normalizedRows.map((row) => ({
    ...row,
    earnings: earningsById.get(row.id) ?? 0,
  }));
}

export async function approveSubmission(db: Db, submissionId: string) {
  return db.transaction(async (tx) => {
    const [submission] = await tx
      .select({
        id: submissions.id,
        campaignId: submissions.campaignId,
        status: submissions.status,
      })
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .limit(1);

    if (!submission) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Submission not found",
      });
    }

    if (submission.status !== "pending") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Only pending submissions can be approved",
      });
    }

    /*
     * Lock the campaign row so concurrent approvals for the same
     * campaign are serialized by Postgres.
     */
    const [campaign] = await tx
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, submission.campaignId))
      .for("update")
      .limit(1);

    if (!campaign) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Campaign not found",
      });
    }

    if (campaign.status === "completed") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Campaign budget is already exhausted",
      });
    }

    const [latestMetric] = await tx
      .select({
        views: submissionMetrics.views,
      })
      .from(submissionMetrics)
      .where(eq(submissionMetrics.submissionId, submission.id))
      .orderBy(desc(submissionMetrics.capturedAt))
      .limit(1);

    const views = latestMetric?.views ?? 0;

    /*
     * The payout is calculated from the most recent metric at the
     * moment of approval.
     *
     * approvedPayout is persisted as the amount reserved against the
     * campaign budget. Later metric growth must not retroactively
     * increase the campaign's reserved spend.
     */
    const payout = calculatePayout(views, campaign.payoutPer1kViews);

    const approvedSubmissions = await tx
      .select({
        approvedPayout: submissions.approvedPayout,
      })
      .from(submissions)
      .where(
        and(
          eq(submissions.campaignId, campaign.id),
          eq(submissions.status, "approved"),
        ),
      );

    const spent = approvedSubmissions.reduce(
      (total, approvedSubmission) =>
        total + (approvedSubmission.approvedPayout ?? 0),
      0,
    );

    const remainingBudget = campaign.totalBudget - spent;

    if (payout > remainingBudget) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Approval would exceed the campaign budget",
      });
    }

    const [updatedSubmission] = await tx
      .update(submissions)
      .set({
        status: "approved",
        approvedPayout: payout,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(submissions.id, submission.id),
          eq(submissions.status, "pending"),
        ),
      )
      .returning();

    if (!updatedSubmission) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Submission was already processed",
      });
    }

    const newSpent = spent + payout;
    const budgetLeft = Math.max(campaign.totalBudget - newSpent, 0);

    if (newSpent >= campaign.totalBudget) {
      await tx
        .update(campaigns)
        .set({
          status: "completed",
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaign.id));
    }

    return {
      submission: updatedSubmission,
      payout,
      spent: newSpent,
      budgetLeft,
    };
  });
}

export async function rejectSubmission(
  db: Db,
  submissionId: string,
  rejectionReason: string,
) {
  const [submission] = await db
    .update(submissions)
    .set({
      status: "rejected",
      rejectionReason,
      updatedAt: new Date(),
    })
    .where(
      and(eq(submissions.id, submissionId), eq(submissions.status, "pending")),
    )
    .returning();

  if (!submission) {
    const existingSubmission = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
    });

    if (!existingSubmission) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Submission not found",
      });
    }

    throw new TRPCError({
      code: "CONFLICT",
      message: "Only pending submissions can be rejected",
    });
  }

  const [campaign] = await db
    .select({
      totalBudget: campaigns.totalBudget,
    })
    .from(campaigns)
    .where(eq(campaigns.id, submission.campaignId))
    .limit(1);

  if (!campaign) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Campaign not found",
    });
  }

  return {
    submission,
    payout: 0,
    spent: 0,
    budgetLeft: campaign.totalBudget,
  };
}
