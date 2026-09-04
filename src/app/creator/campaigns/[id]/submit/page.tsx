"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createClient } from "@/trpc/client";
import {
  createSubmissionSchema,
  type CreateSubmissionInput,
} from "@/modules/submissions/submission.validation";

const trpc = createClient();

export default function SubmitContentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [loadingCampaign, setLoadingCampaign] = useState(true);
  const [campaign, setCampaign] = useState<Awaited<
    ReturnType<typeof trpc.campaign.activeById.query>
  > | null>(null);

  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<CreateSubmissionInput>({
    resolver: zodResolver(createSubmissionSchema),
    defaultValues: {
      campaignId: params.id,
      postUrl: "",
      platform: "tiktok",
    },
  });

  useEffect(() => {
    let cancelled = false;

    async function loadCampaign() {
      setLoadingCampaign(true);
      setCampaignError(null);

      try {
        const result = await trpc.campaign.activeById.query({
          id: params.id,
        });

        if (!cancelled) {
          if (!result) {
            setCampaignError("Campaign not found or is no longer active.");
          } else {
            setCampaign(result);

            const firstPlatform = result.platforms[0];

            if (
              firstPlatform === "tiktok" ||
              firstPlatform === "instagram" ||
              firstPlatform === "youtube"
            ) {
              form.setValue("platform", firstPlatform);
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          setCampaignError(
            error instanceof Error ? error.message : "Failed to load campaign",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingCampaign(false);
        }
      }
    }

    void loadCampaign();

    return () => {
      cancelled = true;
    };
  }, [params.id, form]);

  async function onSubmit(input: CreateSubmissionInput) {
    setSubmitError(null);
    setSuccess(false);

    try {
      await trpc.submission.create.mutate(input);

      setSuccess(true);

      form.reset({
        campaignId: params.id,
        postUrl: "",
        platform: input.platform,
      });
    } catch (error) {
      if (error instanceof Error) {
        setSubmitError(error.message);
      } else {
        setSubmitError("Failed to submit content");
      }
    }
  }

  if (loadingCampaign) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
            Loading campaign...
          </div>
        </div>
      </main>
    );
  }

  if (campaignError || !campaign) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {campaignError ?? "Campaign not found"}
          </div>

          <button
            type="button"
            onClick={() => router.push("/creator")}
            className="mt-4 rounded-md border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Back to campaigns
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() => router.push("/creator")}
          className="mb-6 text-sm text-gray-600 hover:text-gray-900"
        >
          ← Back to campaigns
        </button>

        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">
              Submit Content
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Submit your clip for{" "}
              <span className="font-medium text-gray-900">
                {campaign.title}
              </span>
              .
            </p>
          </div>

          {success && (
            <div
              role="status"
              className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700"
            >
              Your content has been submitted successfully.
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {submitError}
            </div>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label
                htmlFor="platform"
                className="block text-sm font-medium text-gray-900"
              >
                Platform
              </label>

              <select
                id="platform"
                {...form.register("platform")}
                className="mt-2 w-full rounded-md border px-3 py-2.5 text-sm outline-none focus:ring-2"
              >
                {campaign.platforms.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </option>
                ))}
              </select>

              {form.formState.errors.platform && (
                <p className="mt-1 text-sm text-red-600">
                  {form.formState.errors.platform.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="postUrl"
                className="block text-sm font-medium text-gray-900"
              >
                Post URL
              </label>

              <input
                id="postUrl"
                type="url"
                placeholder="https://www.tiktok.com/@creator/video/..."
                {...form.register("postUrl")}
                className="mt-2 w-full rounded-md border px-3 py-2.5 text-sm outline-none focus:ring-2"
              />

              {form.formState.errors.postUrl && (
                <p className="mt-1 text-sm text-red-600">
                  {form.formState.errors.postUrl.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {form.formState.isSubmitting ? "Submitting..." : "Submit Content"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
