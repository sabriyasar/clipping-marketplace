"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/trpc/client";

const trpc = createClient();

type Submissions = Awaited<ReturnType<typeof trpc.submission.my.query>>;

function getStatusClasses(status: string) {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-700";

    case "rejected":
      return "bg-red-100 text-red-700";

    default:
      return "bg-yellow-100 text-yellow-700";
  }
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function MySubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submissions>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSubmissions() {
      setLoading(true);
      setError(null);

      try {
        const result = await trpc.submission.my.query();

        if (!cancelled) {
          setSubmissions(result);
        }
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof Error
              ? error.message
              : "Failed to load submissions",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSubmissions();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              My Submissions
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Track your submitted content, views, and earnings.
            </p>
          </div>

          <a
            href="/creator"
            className="rounded-md border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Browse Campaigns
          </a>
        </div>

        {loading && (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
            Loading submissions...
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {!loading && !error && submissions.length === 0 && (
          <div className="rounded-xl border border-dashed bg-white p-10 text-center shadow-sm">
            <h2 className="text-lg font-semibold">No submissions yet</h2>

            <p className="mt-2 text-sm text-gray-500">
              Browse active campaigns and submit your first clip.
            </p>

            <a
              href="/creator"
              className="mt-5 inline-flex rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              Browse Campaigns
            </a>
          </div>
        )}

        {!loading && !error && submissions.length > 0 && (
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-600">
                      Campaign
                    </th>

                    <th className="px-6 py-4 font-medium text-gray-600">
                      Platform
                    </th>

                    <th className="px-6 py-4 font-medium text-gray-600">
                      Post
                    </th>

                    <th className="px-6 py-4 font-medium text-gray-600">
                      Status
                    </th>

                    <th className="px-6 py-4 text-right font-medium text-gray-600">
                      Views
                    </th>

                    <th className="px-6 py-4 text-right font-medium text-gray-600">
                      Earnings
                    </th>

                    <th className="px-6 py-4 font-medium text-gray-600">
                      Submitted
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {submissions.map((submission) => (
                    <tr key={submission.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {submission.campaignTitle}
                        </div>

                        {submission.rejectionReason && (
                          <div className="mt-1 max-w-xs text-xs text-red-600">
                            {submission.rejectionReason}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 capitalize text-gray-700">
                        {submission.platform}
                      </td>

                      <td className="px-6 py-4">
                        <a
                          href={submission.postUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Open post
                        </a>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                            submission.status,
                          )}`}
                        >
                          {formatStatus(submission.status)}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right font-medium">
                        {submission.views.toLocaleString()}
                      </td>

                      <td className="px-6 py-4 text-right font-medium">
                        {formatMoney(submission.earnings)}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-gray-500">
                        {new Date(submission.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
