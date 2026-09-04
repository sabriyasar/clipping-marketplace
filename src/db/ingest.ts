import "dotenv/config";

import { and, desc, eq } from "drizzle-orm";

import { db } from "./index";
import { submissionMetrics, submissions } from "./schema";

export function fakeViews(previousViews: number) {
  const increase = Math.floor(Math.random() * 5_000) + 1_000;

  return previousViews + increase;
}

export async function ingestSubmission(
  submission: typeof submissions.$inferSelect,
  capturedAt: string,
) {
  const existingMetric = await db.query.submissionMetrics.findFirst({
    where: and(
      eq(submissionMetrics.submissionId, submission.id),
      eq(submissionMetrics.capturedAt, capturedAt),
    ),
  });

  if (existingMetric) {
    return {
      submissionId: submission.id,
      status: "skipped" as const,
      views: existingMetric.views,
    };
  }

  const [latestMetric] = await db
    .select({
      views: submissionMetrics.views,
    })
    .from(submissionMetrics)
    .where(eq(submissionMetrics.submissionId, submission.id))
    .orderBy(desc(submissionMetrics.capturedAt))
    .limit(1);

  const previousViews = latestMetric?.views ?? 0;
  const views = fakeViews(previousViews);

  const [metric] = await db
    .insert(submissionMetrics)
    .values({
      submissionId: submission.id,
      capturedAt,
      views,
      likes: Math.floor(views * 0.05),
      comments: Math.floor(views * 0.01),
    })
    .returning();

  return {
    submissionId: submission.id,
    status: "inserted" as const,
    views: metric.views,
  };
}

export async function runIngest(capturedAt: string) {
  const approvedSubmissions = await db.query.submissions.findMany({
    where: eq(submissions.status, "approved"),
  });

  const failures: Array<{
    submissionId: string;
    error: string;
  }> = [];

  let inserted = 0;
  let skipped = 0;

  for (const submission of approvedSubmissions) {
    try {
      const result = await ingestSubmission(submission, capturedAt);

      if (result.status === "inserted") {
        inserted++;
      } else {
        skipped++;
      }
    } catch (error) {
      failures.push({
        submissionId: submission.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    date: capturedAt,
    total: approvedSubmissions.length,
    inserted,
    skipped,
    failed: failures.length,
    failures,
  };
}

async function main() {
  const capturedAt = new Date().toISOString().slice(0, 10);

  console.log(
    `Starting ingest for ${capturedAt}: processing approved submissions`,
  );

  const result = await runIngest(capturedAt);

  console.log("Ingest completed.");
  console.log(`Inserted: ${result.inserted}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Failed: ${result.failed}`);

  if (result.failures.length > 0) {
    console.error("Failures:");

    for (const failure of result.failures) {
      console.error(`- ${failure.submissionId}: ${failure.error}`);
    }

    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((error) => {
      console.error("Ingest failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$client.end();
    });
}
