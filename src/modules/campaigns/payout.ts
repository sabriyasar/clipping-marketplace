export function calculatePayout(
  views: number,
  payoutPer1kViews: number,
): number {
  return Math.floor(views / 1000) * payoutPer1kViews;
}

export interface AllocatableSubmission {
  id: string;
  status: "pending" | "approved" | "rejected" | "paid";
  views: number;
  updatedAt: Date;
}

/**
 * Allocates a campaign's total_budget across its approved/paid
 * submissions, in approval order (first-come-first-served, per spec).
 *
 * Each submission's raw payout (floor(views/1000) * payout_per_1k_views)
 * keeps growing independently as ingest runs, so the sum of raw payouts
 * can exceed total_budget even though no single approval was ever
 * allowed to push the campaign over budget. This function is the single
 * source of truth for turning "raw payout per submission" into "budget
 * actually attributed to this submission", so it must be used anywhere
 * we display spend or per-submission earnings (campaign overview,
 * creator's submission list, admin's review queue) to keep those views
 * consistent with each other.
 *
 * Approval order is approximated by updatedAt, which is set whenever
 * approveSubmission transitions a row to "approved".
 */
export function allocateBudget<T extends AllocatableSubmission>(
  submissions: T[],
  totalBudget: number,
  payoutPer1kViews: number,
): Map<string, number> {
  const allocatedById = new Map<string, number>();

  const eligible = submissions.filter(
    (submission) =>
      submission.status === "approved" || submission.status === "paid",
  );

  const ordered = [...eligible].sort(
    (a, b) => a.updatedAt.getTime() - b.updatedAt.getTime(),
  );

  let spent = 0;

  for (const submission of ordered) {
    const rawPayout = calculatePayout(submission.views, payoutPer1kViews);
    const remaining = Math.max(totalBudget - spent, 0);
    const payout = Math.min(rawPayout, remaining);

    allocatedById.set(submission.id, payout);
    spent += payout;
  }

  for (const submission of submissions) {
    if (!allocatedById.has(submission.id)) {
      allocatedById.set(submission.id, 0);
    }
  }

  return allocatedById;
}
