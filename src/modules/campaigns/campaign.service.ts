import { and, asc, desc, eq, gt, ilike, lt, sql } from "drizzle-orm";

import type { TRPCContext } from "@/server/trpc/context";
import { campaigns, submissionMetrics, submissions } from "@/db/schema";

import {
  type CreateCampaignInput,
  type UpdateCampaignInput,
  type CampaignListInput,
} from "./campaign.validation";

type Db = TRPCContext["db"];

export async function listCampaigns(db: Db, input: CampaignListInput) {
  const offset = (input.page - 1) * input.pageSize;

  const conditions = [];

  if (input.search) {
    conditions.push(ilike(campaigns.title, `%${input.search}%`));
  }

  if (input.status) {
    conditions.push(eq(campaigns.status, input.status));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(campaigns)
      .where(where)
      .orderBy(desc(campaigns.createdAt))
      .limit(input.pageSize)
      .offset(offset),

    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(campaigns)
      .where(where),
  ]);

  const total = countResult[0]?.count ?? 0;

  return {
    items,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
    },
  };
}

export async function listActiveCampaigns(db: Db) {
  const now = new Date();

  return db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.status, "active"),
        lt(campaigns.startsAt, now),
        gt(campaigns.endsAt, now),
      ),
    )
    .orderBy(asc(campaigns.endsAt));
}

export async function getActiveCampaignById(db: Db, id: string) {
  const now = new Date();

  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, id),
      eq(campaigns.status, "active"),
      lt(campaigns.startsAt, now),
      gt(campaigns.endsAt, now),
    ),
  });

  return campaign ?? null;
}

export async function getCampaignById(db: Db, id: string) {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, id),
  });

  return campaign ?? null;
}

export async function getCampaignOverview(db: Db, campaignId: string) {
  const campaign = await getCampaignById(db, campaignId);

  if (!campaign) {
    return null;
  }

  const approvedSubmissions = await db
    .select({
      id: submissions.id,
      approvedPayout: submissions.approvedPayout,
    })
    .from(submissions)
    .where(
      and(
        eq(submissions.campaignId, campaignId),
        eq(submissions.status, "approved"),
      ),
    );

  const approvedSubmissionIds = new Set(
    approvedSubmissions.map((submission) => submission.id),
  );

  const metricRows = await db
    .select({
      submissionId: submissionMetrics.submissionId,
      capturedAt: submissionMetrics.capturedAt,
      views: submissionMetrics.views,
    })
    .from(submissionMetrics)
    .innerJoin(submissions, eq(submissionMetrics.submissionId, submissions.id))
    .where(
      and(
        eq(submissions.campaignId, campaignId),
        eq(submissions.status, "approved"),
      ),
    )
    .orderBy(asc(submissionMetrics.capturedAt));

  const latestViewsBySubmission = new Map<string, number>();
  const latestDateBySubmission = new Map<string, string>();

  for (const row of metricRows) {
    if (!approvedSubmissionIds.has(row.submissionId)) {
      continue;
    }

    const capturedAt = String(row.capturedAt);
    const existingDate = latestDateBySubmission.get(row.submissionId);

    if (!existingDate || capturedAt > existingDate) {
      latestDateBySubmission.set(row.submissionId, capturedAt);
      latestViewsBySubmission.set(row.submissionId, Number(row.views));
    }
  }

  const approvedRows = approvedSubmissions.map((submission) => ({
    submissionId: submission.id,
    views: latestViewsBySubmission.get(submission.id) ?? 0,
  }));

  // Budget spend is based on the payout reserved at approval time.
  // Later view growth must not retroactively increase campaign spend.
  const spent = approvedSubmissions.reduce((total, submission) => {
    const views = latestViewsBySubmission.get(submission.id) ?? 0;

    const payout = Math.floor(views / 1000) * campaign.payoutPer1kViews;

    return total + payout;
  }, 0);

  const approvedViews = approvedRows.reduce(
    (total, row) => total + row.views,
    0,
  );

  const dailyViewsMap = new Map<string, number>();

  const campaignStartDate = campaign.startsAt.toISOString().slice(0, 10);
  const campaignEndDate = campaign.endsAt.toISOString().slice(0, 10);

  for (const row of metricRows) {
    const date = String(row.capturedAt);

    if (date < campaignStartDate || date > campaignEndDate) {
      continue;
    }

    dailyViewsMap.set(date, (dailyViewsMap.get(date) ?? 0) + Number(row.views));
  }

  const dailyViews: Array<{
    date: string;
    views: number;
  }> = [];

  const currentDate = new Date(campaign.startsAt);
  currentDate.setUTCHours(0, 0, 0, 0);

  const endDate = new Date(campaign.endsAt);
  endDate.setUTCHours(0, 0, 0, 0);

  while (currentDate <= endDate) {
    const date = currentDate.toISOString().slice(0, 10);

    dailyViews.push({
      date,
      views: dailyViewsMap.get(date) ?? 0,
    });

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  const budgetLeft = Math.max(campaign.totalBudget - spent, 0);

  return {
    campaign,
    spent,
    budgetLeft,
    approvedViews,
    dailyViews,
  };
}

export async function createCampaign(db: Db, input: CreateCampaignInput) {
  const [campaign] = await db
    .insert(campaigns)
    .values({
      title: input.title,
      platforms: input.platforms,
      payoutPer1kViews: input.payoutPer1kViews,
      totalBudget: input.totalBudget,
      status: input.status,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    })
    .returning();

  return campaign;
}

export async function updateCampaign(db: Db, input: UpdateCampaignInput) {
  const [campaign] = await db
    .update(campaigns)
    .set({
      title: input.title,
      platforms: input.platforms,
      payoutPer1kViews: input.payoutPer1kViews,
      totalBudget: input.totalBudget,
      status: input.status,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, input.id))
    .returning();

  return campaign ?? null;
}
