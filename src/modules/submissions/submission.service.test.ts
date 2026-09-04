import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { campaigns, submissionMetrics, submissions, users } from "@/db/schema";
import {
  approveSubmission,
  createSubmission,
  listMySubmissions,
  rejectSubmission,
} from "./submission.service";

describe("approveSubmission", () => {
  it("rejects approval when payout exceeds remaining campaign budget", async () => {
    const [creator] = await db
      .insert(users)
      .values({
        email: `test-${crypto.randomUUID()}@example.com`,
        role: "creator",
      })
      .returning();

    const [campaign] = await db
      .insert(campaigns)
      .values({
        title: "Budget test",
        platforms: ["tiktok"],
        payoutPer1kViews: 500,
        totalBudget: 500,
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
        status: "pending",
      })
      .returning();

    await db.insert(submissionMetrics).values({
      submissionId: submission.id,
      capturedAt: new Date().toISOString().slice(0, 10),
      views: 2_000,
      likes: 0,
      comments: 0,
    });

    await expect(approveSubmission(db, submission.id)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Approval would exceed the campaign budget",
    });

    const [currentSubmission] = await db
      .select({
        status: submissions.status,
      })
      .from(submissions)
      .where(eq(submissions.id, submission.id));

    expect(currentSubmission.status).toBe("pending");
  });

  it("allows only one concurrent approval when the budget covers one payout", async () => {
    const [creator] = await db
      .insert(users)
      .values({
        email: `test-${crypto.randomUUID()}@example.com`,
        role: "creator",
      })
      .returning();

    const [campaign] = await db
      .insert(campaigns)
      .values({
        title: "Concurrent approval test",
        platforms: ["tiktok"],
        payoutPer1kViews: 500,
        totalBudget: 500,
        status: "active",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86_400_000),
      })
      .returning();

    const [submissionA] = await db
      .insert(submissions)
      .values({
        campaignId: campaign.id,
        creatorId: creator.id,
        postUrl: `https://tiktok.com/@test/video/${crypto.randomUUID()}`,
        platform: "tiktok",
        status: "pending",
      })
      .returning();

    const [submissionB] = await db
      .insert(submissions)
      .values({
        campaignId: campaign.id,
        creatorId: creator.id,
        postUrl: `https://tiktok.com/@test/video/${crypto.randomUUID()}`,
        platform: "tiktok",
        status: "pending",
      })
      .returning();

    const capturedAt = new Date().toISOString().slice(0, 10);

    await db.insert(submissionMetrics).values([
      {
        submissionId: submissionA.id,
        capturedAt,
        views: 1_000,
        likes: 0,
        comments: 0,
      },
      {
        submissionId: submissionB.id,
        capturedAt,
        views: 1_000,
        likes: 0,
        comments: 0,
      },
    ]);

    const results = await Promise.allSettled([
      approveSubmission(db, submissionA.id),
      approveSubmission(db, submissionB.id),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const [currentSubmissionA] = await db
      .select({
        status: submissions.status,
      })
      .from(submissions)
      .where(eq(submissions.id, submissionA.id));

    const [currentSubmissionB] = await db
      .select({
        status: submissions.status,
      })
      .from(submissions)
      .where(eq(submissions.id, submissionB.id));

    const statuses = [currentSubmissionA.status, currentSubmissionB.status];

    expect(statuses.filter((status) => status === "approved")).toHaveLength(1);
    expect(statuses.filter((status) => status === "pending")).toHaveLength(1);

    const [currentCampaign] = await db
      .select({
        status: campaigns.status,
      })
      .from(campaigns)
      .where(eq(campaigns.id, campaign.id));

    expect(currentCampaign.status).toBe("completed");
  });

  it("keeps approved payout fixed when views increase after approval", async () => {
    const [creator] = await db
      .insert(users)
      .values({
        email: `payout-reservation-${crypto.randomUUID()}@example.com`,
        role: "creator",
      })
      .returning();

    const [campaign] = await db
      .insert(campaigns)
      .values({
        title: "Approved payout reservation test",
        platforms: ["tiktok"],
        payoutPer1kViews: 5,
        totalBudget: 10,
        status: "active",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86_400_000),
      })
      .returning();

    const [submissionA] = await db
      .insert(submissions)
      .values({
        campaignId: campaign.id,
        creatorId: creator.id,
        postUrl: `https://tiktok.com/@test/video/${crypto.randomUUID()}`,
        platform: "tiktok",
        status: "pending",
      })
      .returning();

    await db.insert(submissionMetrics).values({
      submissionId: submissionA.id,
      capturedAt: "2026-09-01",
      views: 1_000,
      likes: 0,
      comments: 0,
    });

    const firstApproval = await approveSubmission(db, submissionA.id);

    expect(firstApproval.payout).toBe(5);
    expect(firstApproval.spent).toBe(5);
    expect(firstApproval.budgetLeft).toBe(5);

    await db.insert(submissionMetrics).values({
      submissionId: submissionA.id,
      capturedAt: "2026-09-02",
      views: 13_750,
      likes: 0,
      comments: 0,
    });

    const [submissionB] = await db
      .insert(submissions)
      .values({
        campaignId: campaign.id,
        creatorId: creator.id,
        postUrl: `https://tiktok.com/@test/video/${crypto.randomUUID()}`,
        platform: "tiktok",
        status: "pending",
      })
      .returning();

    await db.insert(submissionMetrics).values({
      submissionId: submissionB.id,
      capturedAt: "2026-09-02",
      views: 1_000,
      likes: 0,
      comments: 0,
    });

    const secondApproval = await approveSubmission(db, submissionB.id);

    expect(secondApproval.payout).toBe(5);
    expect(secondApproval.spent).toBe(10);
    expect(secondApproval.budgetLeft).toBe(0);

    const [currentCampaign] = await db
      .select({
        status: campaigns.status,
      })
      .from(campaigns)
      .where(eq(campaigns.id, campaign.id));

    expect(currentCampaign.status).toBe("completed");
  });

  it("only returns submissions owned by the requesting creator", async () => {
    const [creatorA] = await db
      .insert(users)
      .values({
        email: `creator-a-${crypto.randomUUID()}@example.com`,
        role: "creator",
      })
      .returning();

    const [creatorB] = await db
      .insert(users)
      .values({
        email: `creator-b-${crypto.randomUUID()}@example.com`,
        role: "creator",
      })
      .returning();

    const [campaign] = await db
      .insert(campaigns)
      .values({
        title: "Access control test",
        platforms: ["tiktok"],
        payoutPer1kViews: 500,
        totalBudget: 10_000,
        status: "active",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86_400_000),
      })
      .returning();

    const submissionA = await createSubmission(db, creatorA.id, {
      campaignId: campaign.id,
      postUrl: `https://tiktok.com/@creator-a/video/${crypto.randomUUID()}`,
      platform: "tiktok",
    });

    await createSubmission(db, creatorB.id, {
      campaignId: campaign.id,
      postUrl: `https://tiktok.com/@creator-b/video/${crypto.randomUUID()}`,
      platform: "tiktok",
    });

    const creatorASubmissions = await listMySubmissions(db, creatorA.id);

    expect(creatorASubmissions).toHaveLength(1);
    expect(creatorASubmissions[0].id).toBe(submissionA.id);
  });
});

describe("rejectSubmission", () => {
  it("rejects a pending submission with a rejection reason", async () => {
    const [creator] = await db
      .insert(users)
      .values({
        email: `reject-${crypto.randomUUID()}@example.com`,
        role: "creator",
      })
      .returning();

    const [campaign] = await db
      .insert(campaigns)
      .values({
        title: "Reject test",
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
        status: "pending",
      })
      .returning();

    const result = await rejectSubmission(
      db,
      submission.id,
      "Post URL could not be verified",
    );

    expect(result.submission.status).toBe("rejected");
    expect(result.submission.rejectionReason).toBe(
      "Post URL could not be verified",
    );
  });

  it("does not allow rejecting an already processed submission", async () => {
    const [creator] = await db
      .insert(users)
      .values({
        email: `reject-processed-${crypto.randomUUID()}@example.com`,
        role: "creator",
      })
      .returning();

    const [campaign] = await db
      .insert(campaigns)
      .values({
        title: "Reject processed test",
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

    await expect(
      rejectSubmission(db, submission.id, "This should not be allowed"),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Only pending submissions can be rejected",
    });
  });
});
