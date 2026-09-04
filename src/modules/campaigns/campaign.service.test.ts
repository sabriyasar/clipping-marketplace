import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { campaigns, submissionMetrics, submissions, users } from "@/db/schema";

import { getCampaignOverview } from "./campaign.service";

describe("getCampaignOverview", () => {
  it("calculates budget spent from the latest metric payout", async () => {
    const [creator] = await db
      .insert(users)
      .values({
        email: `overview-${crypto.randomUUID()}@example.com`,
        role: "creator",
      })
      .returning();

    const [campaign] = await db
      .insert(campaigns)
      .values({
        title: "Overview payout test",
        platforms: ["tiktok"],
        payoutPer1kViews: 5,
        totalBudget: 100,
        status: "active",
        startsAt: new Date("2026-09-01T00:00:00.000Z"),
        endsAt: new Date("2026-09-05T23:59:59.999Z"),
      })
      .returning();

    const [submission] = await db
      .insert(submissions)
      .values({
        campaignId: campaign.id,
        creatorId: creator.id,
        postUrl: `https://tiktok.com/@test/video/${crypto.randomUUID()}`,
        platform: "tiktok",
        status: "approved",
        approvedPayout: 0,
      })
      .returning();

    await db.insert(submissionMetrics).values([
      {
        submissionId: submission.id,
        capturedAt: "2026-09-01",
        views: 1_000,
        likes: 0,
        comments: 0,
      },
      {
        submissionId: submission.id,
        capturedAt: "2026-09-02",
        views: 13_750,
        likes: 0,
        comments: 0,
      },
    ]);

    const overview = await getCampaignOverview(db, campaign.id);

    expect(overview).not.toBeNull();

    // floor(13_750 / 1_000) * 5 = 65 cents
    expect(overview?.spent).toBe(65);
    expect(overview?.budgetLeft).toBe(35);
    expect(overview?.approvedViews).toBe(13_750);
  });

  it("never reports spent above total_budget even after post-approval view growth exceeds it", async () => {
    const [creator] = await db
      .insert(users)
      .values({
        email: `overview-cap-${crypto.randomUUID()}@example.com`,
        role: "creator",
      })
      .returning();

    // total_budget: 10 cents, payout_per_1k_views: 5 cents.
    // A single approved submission whose views grow past 3,000 would
    // theoretically earn 15 cents (floor(3000/1000) * 5), which already
    // exceeds the 10 cent budget. The approval-time check can't prevent
    // this because the views (and therefore the computed payout) keep
    // climbing after approval via daily ingest.
    const [campaign] = await db
      .insert(campaigns)
      .values({
        title: "Budget ceiling overview test",
        platforms: ["tiktok"],
        payoutPer1kViews: 5,
        totalBudget: 10,
        status: "active",
        startsAt: new Date("2026-09-01T00:00:00.000Z"),
        endsAt: new Date("2026-09-05T23:59:59.999Z"),
      })
      .returning();

    const [submission] = await db
      .insert(submissions)
      .values({
        campaignId: campaign.id,
        creatorId: creator.id,
        postUrl: `https://tiktok.com/@test/video/${crypto.randomUUID()}`,
        platform: "tiktok",
        status: "approved",
        approvedPayout: 0,
      })
      .returning();

    await db.insert(submissionMetrics).values([
      {
        submissionId: submission.id,
        capturedAt: "2026-09-01",
        views: 1_000,
        likes: 0,
        comments: 0,
      },
      {
        submissionId: submission.id,
        capturedAt: "2026-09-02",
        // floor(5_151 / 1_000) * 5 = 25 cents, well above the 10 cent budget
        views: 5_151,
        likes: 0,
        comments: 0,
      },
    ]);

    const overview = await getCampaignOverview(db, campaign.id);

    expect(overview).not.toBeNull();

    expect(overview?.spent).toBeLessThanOrEqual(campaign.totalBudget);
    expect(overview?.spent).toBe(10);
    expect(overview?.budgetLeft).toBe(0);
    expect(overview?.budgetLeft).toBeGreaterThanOrEqual(0);
    expect(overview?.approvedViews).toBe(5_151);
  });
});
