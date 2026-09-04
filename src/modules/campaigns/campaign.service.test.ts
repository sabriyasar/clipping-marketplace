import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { campaigns, submissionMetrics, submissions, users } from "@/db/schema";

import { getCampaignOverview } from "./campaign.service";

describe("getCampaignOverview", () => {
  it("keeps budget spent fixed when approved submission views increase", async () => {
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
        title: "Overview payout reservation test",
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
        approvedPayout: 5,
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

    expect(overview?.spent).toBe(5);
    expect(overview?.budgetLeft).toBe(5);
    expect(overview?.approvedViews).toBe(13_750);
  });
});
