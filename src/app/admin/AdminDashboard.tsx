"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import LogoutButton from "@/components/LogoutButton";
import { createClient } from "@/trpc/client";

const trpc = createClient();

type CampaignStatus = "draft" | "active" | "paused" | "completed";

export default function AdminDashboard() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CampaignStatus | undefined>();

  const [data, setData] = useState<Awaited<
    ReturnType<typeof trpc.campaign.list.query>
  > | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCampaigns() {
      setLoading(true);
      setError(null);

      try {
        const result = await trpc.campaign.list.query({
          page,
          pageSize: 10,
          search: search.trim() || undefined,
          status,
        });

        if (!cancelled) {
          setData(result);
        }
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof Error ? error.message : "Failed to load campaigns",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCampaigns();

    return () => {
      cancelled = true;
    };
  }, [page, search, status]);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Admin Dashboard
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Manage campaigns and review creator submissions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/campaigns/new"
              className="inline-flex h-10 items-center justify-center rounded-md bg-black px-4 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            >
              Create Campaign
            </Link>

            <LogoutButton />
          </div>
        </div>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Campaigns</h2>

            <p className="text-sm text-gray-500">
              Manage your campaigns and budgets.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <label className="flex-1">
              <span className="sr-only">Search campaigns</span>

              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search campaigns..."
                className="h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-black"
              />
            </label>

            <label>
              <span className="sr-only">Filter by status</span>

              <select
                value={status ?? ""}
                onChange={(event) => {
                  const value = event.target.value;

                  setStatus(value ? (value as CampaignStatus) : undefined);

                  setPage(1);
                }}
                className="h-10 rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-black"
              >
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </label>
          </div>

          {loading && (
            <div
              className="mt-6 rounded-lg border p-8 text-center text-sm text-gray-500"
              role="status"
              aria-live="polite"
            >
              Loading campaigns...
            </div>
          )}

          {error && (
            <div
              className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          {!loading && !error && data && data.items.length === 0 && (
            <div className="mt-6 rounded-lg border border-dashed p-10 text-center">
              <p className="text-sm text-gray-500">No campaigns found.</p>

              {(search || status) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatus(undefined);
                    setPage(1);
                  }}
                  className="mt-3 text-sm font-medium underline underline-offset-4"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {!loading && !error && data && data.items.length > 0 && (
            <>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Campaign list</caption>

                  <thead>
                    <tr className="border-b text-gray-500">
                      <th scope="col" className="px-3 py-3 font-medium">
                        Title
                      </th>

                      <th scope="col" className="px-3 py-3 font-medium">
                        Platform
                      </th>

                      <th scope="col" className="px-3 py-3 font-medium">
                        Status
                      </th>

                      <th scope="col" className="px-3 py-3 font-medium">
                        Budget
                      </th>

                      <th scope="col" className="px-3 py-3 font-medium">
                        Payout / 1K
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.items.map((campaign) => (
                      <tr
                        key={campaign.id}
                        className="border-b last:border-0 hover:bg-gray-50"
                      >
                        <td className="px-3 py-4 font-medium">
                          <Link
                            href={`/admin/campaigns/${campaign.id}`}
                            className="rounded-sm underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-black"
                          >
                            {campaign.title}
                          </Link>
                        </td>

                        <td className="px-3 py-4">
                          {campaign.platforms.join(", ")}
                        </td>

                        <td className="px-3 py-4">
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium capitalize">
                            {campaign.status}
                          </span>
                        </td>

                        <td className="px-3 py-4">
                          {(campaign.totalBudget / 100).toFixed(2)}
                        </td>

                        <td className="px-3 py-4">
                          {(campaign.payoutPer1kViews / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <p className="text-sm text-gray-500">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((value) => value - 1)}
                    className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    disabled={page >= data.pagination.totalPages || loading}
                    onClick={() => setPage((value) => value + 1)}
                    className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
