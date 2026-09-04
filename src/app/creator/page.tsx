"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import LogoutButton from "@/components/LogoutButton";
import { createClient } from "@/trpc/client";

const trpc = createClient();

export default function CreatorDashboard() {
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<
    Awaited<ReturnType<typeof trpc.campaign.active.query>>
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCampaigns() {
      setLoading(true);
      setError(null);

      try {
        const result = await trpc.campaign.active.query();

        if (!cancelled) {
          setCampaigns(result);
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
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Creator Dashboard
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Browse active campaigns and submit your content.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/creator/submissions")}
              className="rounded-md border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              My Submissions
            </button>

            <LogoutButton />
          </div>
        </div>

        {loading && (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
            Loading campaigns...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && campaigns.length === 0 && (
          <div className="rounded-xl border border-dashed bg-white p-10 text-center shadow-sm">
            <p className="text-sm text-gray-500">
              There are no active campaigns right now.
            </p>
          </div>
        )}

        {!loading && !error && campaigns.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <article
                key={campaign.id}
                className="rounded-xl border bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-semibold">{campaign.title}</h2>

                  <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                    Active
                  </span>
                </div>

                <div className="mt-5 space-y-3 text-sm">
                  <div>
                    <p className="text-gray-500">Platforms</p>
                    <p className="mt-1 font-medium capitalize">
                      {campaign.platforms.join(", ")}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500">Payout / 1K Views</p>
                    <p className="mt-1 font-medium">
                      {(campaign.payoutPer1kViews / 100).toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500">Campaign Ends</p>
                    <p className="mt-1 font-medium">
                      {new Date(campaign.endsAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push(`/creator/campaigns/${campaign.id}/submit`)
                  }
                  className="mt-6 w-full rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Submit Content
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
