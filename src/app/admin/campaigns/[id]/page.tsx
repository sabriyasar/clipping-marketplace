"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/trpc/client";

const trpc = createClient();

type ReviewAction = "approve" | "reject";

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const campaignId = params.id;

  const [campaign, setCampaign] =
    useState<Awaited<ReturnType<typeof trpc.campaign.getById.query>>>(null);

  const [overview, setOverview] =
    useState<Awaited<ReturnType<typeof trpc.campaign.overview.query>>>(null);

  const [submissions, setSubmissions] = useState<
    Awaited<ReturnType<typeof trpc.submission.listByCampaign.query>>
  >([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [rejectingSubmissionId, setRejectingSubmissionId] = useState<
    string | null
  >(null);

  const [rejectionReason, setRejectionReason] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [campaignResult, overviewResult, submissionResult] =
        await Promise.all([
          trpc.campaign.getById.query({
            id: campaignId,
          }),
          trpc.campaign.overview.query({
            id: campaignId,
          }),
          trpc.submission.listByCampaign.query({
            id: campaignId,
          }),
        ]);

      setCampaign(campaignResult);
      setOverview(overviewResult);
      setSubmissions(submissionResult);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to load campaign",
      );
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (campaignId) {
      void loadData();
    }
  }, [campaignId, loadData]);

  const dailyViews = useMemo(() => overview?.dailyViews ?? [], [overview]);

  const maxDailyViews = useMemo(() => {
    return Math.max(...dailyViews.map((item) => item.views), 1);
  }, [dailyViews]);

  const pendingCount = submissions.filter(
    (submission) => submission.status === "pending",
  ).length;

  async function handleReview(submissionId: string, action: ReviewAction) {
    setActionError(null);
    setSuccessMessage(null);

    if (action === "reject" && !rejectionReason.trim()) {
      setActionError("Rejection reason is required.");
      return;
    }

    setActionLoading(true);

    try {
      await trpc.submission.review.mutate({
        submissionId,
        action,
        ...(action === "reject"
          ? {
              rejectionReason: rejectionReason.trim(),
            }
          : {}),
      });

      setRejectingSubmissionId(null);
      setRejectionReason("");

      setSuccessMessage(
        action === "approve"
          ? "Submission approved successfully."
          : "Submission rejected successfully.",
      );

      await loadData();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to review submission",
      );
    } finally {
      setActionLoading(false);
    }
  }

  function formatMoney(cents: number) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatNumber(value: number) {
    return new Intl.NumberFormat("en-US").format(value);
  }

  function formatDate(value: string | Date) {
    return new Date(value).toLocaleString();
  }

  function formatShortDate(value: string) {
    return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function getStatusClasses(status: string) {
    switch (status) {
      case "active":
      case "approved":
        return "bg-green-100 text-green-700";

      case "pending":
        return "bg-yellow-100 text-yellow-700";

      case "rejected":
        return "bg-red-100 text-red-700";

      case "completed":
        return "bg-blue-100 text-blue-700";

      case "paused":
        return "bg-orange-100 text-orange-700";

      case "paid":
        return "bg-purple-100 text-purple-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <div
            className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500"
            role="status"
          >
            Loading campaign...
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="mb-6 text-sm text-gray-500 hover:text-gray-900"
          >
            ← Back to campaigns
          </button>

          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!campaign || !overview) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="mb-6 text-sm text-gray-500 hover:text-gray-900"
          >
            ← Back to campaigns
          </button>

          <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500">
            Campaign not found.
          </div>
        </div>
      </main>
    );
  }

  const spent = overview.spent;
  const budgetLeft = overview.budgetLeft;
  const budgetPercentage =
    campaign.totalBudget > 0
      ? Math.min((spent / campaign.totalBudget) * 100, 100)
      : 0;

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="mb-6 text-sm font-medium text-gray-500 transition hover:text-gray-900"
        >
          ← Back to campaigns
        </button>

        <div className="mb-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                  {campaign.title}
                </h1>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                    campaign.status,
                  )}`}
                >
                  {campaign.status}
                </span>
              </div>

              <p className="mt-2 text-sm text-gray-500">
                Campaign overview and creator submission review.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push(`/admin/campaigns/${campaign.id}/edit`)
              }
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              Edit Campaign
            </button>
          </div>
        </div>

        {successMessage ? (
          <div
            className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700"
            role="status"
          >
            {successMessage}
          </div>
        ) : null}

        {actionError ? (
          <div
            className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            role="alert"
          >
            {actionError}
          </div>
        ) : null}

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Budget</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatMoney(campaign.totalBudget)}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Spent</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatMoney(spent)}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Budget Left</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatMoney(budgetLeft)}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Approved Views</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatNumber(overview.approvedViews)}
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Budget Overview
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Current campaign budget utilization.
              </p>
            </div>

            <span className="text-sm font-medium text-gray-600">
              {budgetPercentage.toFixed(1)}% used
            </span>
          </div>

          <div
            className="mt-5 h-3 overflow-hidden rounded-full bg-gray-100"
            aria-label={`Budget ${budgetPercentage.toFixed(1)} percent used`}
          >
            <div
              className="h-full rounded-full bg-gray-900 transition-all"
              style={{ width: `${budgetPercentage}%` }}
            />
          </div>
        </section>

        <section className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Campaign Details
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Campaign configuration and schedule.
            </p>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-gray-500">Platforms</p>
              <p className="mt-1 font-medium capitalize text-gray-900">
                {campaign.platforms.join(", ")}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Payout / 1K Views</p>
              <p className="mt-1 font-medium text-gray-900">
                {formatMoney(campaign.payoutPer1kViews)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Starts</p>
              <p className="mt-1 font-medium text-gray-900">
                {formatDate(campaign.startsAt)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Ends</p>
              <p className="mt-1 font-medium text-gray-900">
                {formatDate(campaign.endsAt)}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Daily Views
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Approved submission views across the campaign period.
              </p>
            </div>

            <span className="text-sm text-gray-500">
              {dailyViews.length} day{dailyViews.length === 1 ? "" : "s"}
            </span>
          </div>

          {dailyViews.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed p-10 text-center text-sm text-gray-500">
              No daily view data available.
            </div>
          ) : (
            <div className="mt-6">
              <div className="flex h-64 items-end gap-1 overflow-x-auto border-b border-gray-200 px-2 pb-0">
                {dailyViews.map((item) => {
                  const height =
                    item.views === 0
                      ? 0
                      : Math.max((item.views / maxDailyViews) * 100, 3);

                  return (
                    <div
                      key={item.date}
                      className="group flex h-full min-w-8 flex-1 flex-col justify-end"
                      title={`${formatShortDate(item.date)}: ${formatNumber(
                        item.views,
                      )} views`}
                    >
                      <div className="relative flex h-full items-end justify-center">
                        {item.views > 0 ? (
                          <div
                            className="w-full max-w-10 rounded-t bg-gray-900 transition-opacity group-hover:opacity-75"
                            style={{ height: `${height}%` }}
                          />
                        ) : (
                          <div className="mb-0.5 h-px w-full max-w-10 bg-gray-200" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex gap-1 overflow-x-auto px-2">
                {dailyViews.map((item) => (
                  <div
                    key={item.date}
                    className="min-w-8 flex-1 text-center text-[10px] text-gray-400"
                  >
                    {formatShortDate(item.date)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Submission Review
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Review creator submissions for this campaign.
              </p>
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>
                {submissions.length} submission
                {submissions.length === 1 ? "" : "s"}
              </span>

              {pendingCount > 0 ? (
                <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-700">
                  {pendingCount} pending
                </span>
              ) : null}
            </div>
          </div>

          {submissions.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed p-10 text-center">
              <p className="text-sm text-gray-500">No submissions yet.</p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <caption className="sr-only">
                  Creator submissions for {campaign.title}
                </caption>

                <thead>
                  <tr className="border-b text-gray-500">
                    <th scope="col" className="px-3 py-3 font-medium">
                      Creator
                    </th>

                    <th scope="col" className="px-3 py-3 font-medium">
                      Platform
                    </th>

                    <th scope="col" className="px-3 py-3 font-medium">
                      Post URL
                    </th>

                    <th scope="col" className="px-3 py-3 font-medium">
                      Views
                    </th>

                    <th scope="col" className="px-3 py-3 font-medium">
                      Earnings
                    </th>

                    <th scope="col" className="px-3 py-3 font-medium">
                      Status
                    </th>

                    <th scope="col" className="px-3 py-3 font-medium">
                      Created
                    </th>

                    <th
                      scope="col"
                      className="px-3 py-3 text-right font-medium"
                    >
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {submissions.map((submission) => (
                    <tr key={submission.id} className="border-b last:border-0">
                      <td className="px-3 py-4 font-medium text-gray-900">
                        {submission.creatorEmail}
                      </td>

                      <td className="px-3 py-4 capitalize text-gray-700">
                        {submission.platform}
                      </td>

                      <td className="max-w-xs px-3 py-4">
                        <a
                          href={submission.postUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block max-w-xs truncate text-blue-600 hover:underline"
                          title={submission.postUrl}
                        >
                          {submission.postUrl}
                        </a>
                      </td>

                      <td className="px-3 py-4 font-medium text-gray-900">
                        {formatNumber(Number(submission.views))}
                      </td>

                      <td className="px-3 py-4 font-medium text-gray-900">
                        {formatMoney(Number(submission.earnings))}
                      </td>

                      <td className="px-3 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${getStatusClasses(
                            submission.status,
                          )}`}
                        >
                          {submission.status}
                        </span>

                        {submission.rejectionReason ? (
                          <p
                            className="mt-2 max-w-40 truncate text-xs text-red-600"
                            title={submission.rejectionReason}
                          >
                            {submission.rejectionReason}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-3 py-4 text-gray-500">
                        {formatDate(submission.createdAt)}
                      </td>

                      <td className="px-3 py-4 text-right">
                        {submission.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() =>
                                void handleReview(submission.id, "approve")
                              }
                              className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Approve
                            </button>

                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => {
                                setActionError(null);
                                setSuccessMessage(null);
                                setRejectingSubmissionId(submission.id);
                                setRejectionReason("");
                              }}
                              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {rejectingSubmissionId ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !actionLoading) {
                setRejectingSubmissionId(null);
                setRejectionReason("");
              }
            }}
          >
            <div
              className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="reject-dialog-title"
            >
              <h2
                id="reject-dialog-title"
                className="text-lg font-semibold text-gray-900"
              >
                Reject Submission
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Please provide a reason for rejecting this submission.
              </p>

              <label
                htmlFor="rejection-reason"
                className="mt-5 block text-sm font-medium text-gray-700"
              >
                Rejection reason
              </label>

              <textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                rows={4}
                autoFocus
                disabled={actionLoading}
                placeholder="Explain why this submission is being rejected..."
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-100"
              />

              {actionError ? (
                <p className="mt-2 text-sm text-red-600" role="alert">
                  {actionError}
                </p>
              ) : null}

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => {
                    setRejectingSubmissionId(null);
                    setRejectionReason("");
                    setActionError(null);
                  }}
                  className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => {
                    if (rejectingSubmissionId) {
                      void handleReview(rejectingSubmissionId, "reject");
                    }
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionLoading ? "Rejecting..." : "Reject Submission"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
