import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "./index";
import { campaigns, submissionMetrics, submissions, users } from "./schema";
import { runIngest } from "./ingest";

describe("ingest", () => {
  it("creates one metric row for an approved submission", async () => {
    const [creator] = await db
      .insert(users)
      .values({
        email: `ingest-${crypto.randomUUID()}@example.com`,
        role: "creator",
      })
      .returning();

    const [campaign] = await db
      .insert(campaigns)
      .values({
        title: "Ingest test",
        platforms: ["tiktok"],
        payoutPer1kViews: 500,
        totalBudget: 10_000,
        status: "active",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86_400_000),
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
      })
      .returning();

    const capturedAt = "2026-09-10";

    const result = await runIngest(capturedAt);

    expect(result.inserted).toBeGreaterThanOrEqual(1);

    const metrics = await db
      .select()
      .from(submissionMetrics)
      .where(
        and(
          eq(submissionMetrics.submissionId, submission.id),
          eq(submissionMetrics.capturedAt, capturedAt),
        ),
      );

    expect(metrics).toHaveLength(1);
    expect(metrics[0].views).toBeGreaterThan(0);
  });

  it("does not create another metric when ingest is rerun for the same day", async () => {
    const [creator] = await db
      .insert(users)
      .values({
        email: `ingest-rerun-${crypto.randomUUID()}@example.com`,
        role: "creator",
      })
      .returning();

    const [campaign] = await db
      .insert(campaigns)
      .values({
        title: "Ingest rerun test",
        platforms: ["tiktok"],
        payoutPer1kViews: 500,
        totalBudget: 10_000,
        status: "active",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86_400_000),
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
      })
      .returning();

    const capturedAt = "2026-09-11";

    const firstResult = await runIngest(capturedAt);
    const secondResult = await runIngest(capturedAt);

    expect(firstResult.inserted).toBeGreaterThanOrEqual(1);
    expect(secondResult.skipped).toBeGreaterThanOrEqual(1);

    const metrics = await db
      .select()
      .from(submissionMetrics)
      .where(
        and(
          eq(submissionMetrics.submissionId, submission.id),
          eq(submissionMetrics.capturedAt, capturedAt),
        ),
      );

    expect(metrics).toHaveLength(1);
  });

  it("never decreases views between days", async () => {
    const [creator] = await db
      .insert(users)
      .values({
        email: `ingest-views-${crypto.randomUUID()}@example.com`,
        role: "creator",
      })
      .returning();

    const [campaign] = await db
      .insert(campaigns)
      .values({
        title: "Ingest views test",
        platforms: ["tiktok"],
        payoutPer1kViews: 500,
        totalBudget: 10_000,
        status: "active",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86_400_000),
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
      })
      .returning();

    await db.insert(submissionMetrics).values({
      submissionId: submission.id,
      capturedAt: "2026-09-12",
      views: 100_000,
      likes: 5_000,
      comments: 1_000,
    });

    const result = await runIngest("2026-09-13");

    expect(result.inserted).toBeGreaterThanOrEqual(1);

    const metrics = await db
      .select()
      .from(submissionMetrics)
      .where(eq(submissionMetrics.submissionId, submission.id))
      .orderBy(submissionMetrics.capturedAt);

    expect(metrics).toHaveLength(2);
    expect(metrics[1].views).toBeGreaterThanOrEqual(metrics[0].views);
  });
});
