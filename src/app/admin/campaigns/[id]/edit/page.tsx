"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { campaignFormSchema } from "@/modules/campaigns/campaign.validation";
import { createClient } from "@/trpc/client";

const trpc = createClient();

const platforms = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
] as const;

const statuses = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
] as const;

function formatDateTimeLocal(value: string | Date) {
  const date = new Date(value);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function EditCampaignPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const campaignId = params.id;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<
    z.input<typeof campaignFormSchema>,
    unknown,
    z.output<typeof campaignFormSchema>
  >({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      title: "",
      platforms: ["tiktok"],
      payoutPer1kViews: 500,
      totalBudget: 10000,
      status: "draft",
      startsAt: "",
      endsAt: "",
    },
  });

  useEffect(() => {
    let cancelled = false;

    async function loadCampaign() {
      setLoading(true);
      setLoadError(null);

      try {
        const campaign = await trpc.campaign.getById.query({
          id: campaignId,
        });

        if (cancelled) {
          return;
        }

        if (!campaign) {
          setLoadError("Campaign not found.");
          return;
        }

        reset({
          title: campaign.title,
          platforms: campaign.platforms as z.input<
            typeof campaignFormSchema
          >["platforms"],
          payoutPer1kViews: campaign.payoutPer1kViews,
          totalBudget: campaign.totalBudget,
          status: campaign.status,
          startsAt: formatDateTimeLocal(campaign.startsAt),
          endsAt: formatDateTimeLocal(campaign.endsAt),
        });
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Failed to load campaign",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (campaignId) {
      void loadCampaign();
    }

    return () => {
      cancelled = true;
    };
  }, [campaignId, reset]);

  async function onSubmit(data: z.output<typeof campaignFormSchema>) {
    setSubmitError(null);

    try {
      await trpc.campaign.update.mutate({
        id: campaignId,
        ...data,
      });

      router.push(`/admin/campaigns/${campaignId}`);
      router.refresh();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Campaign could not be updated.",
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-2xl">
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

  if (loadError) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-2xl">
          <button
            type="button"
            onClick={() => router.push(`/admin/campaigns/${campaignId}`)}
            className="mb-6 text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            ← Back to campaign
          </button>

          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            role="alert"
          >
            {loadError}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push(`/admin/campaigns/${campaignId}`)}
            disabled={isSubmitting}
            className="mb-4 text-sm font-medium text-gray-500 hover:text-gray-900 disabled:opacity-50"
          >
            ← Back to campaign
          </button>

          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Edit Campaign
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Update the campaign configuration.
          </p>
        </div>

        {submitError ? (
          <div
            className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            role="alert"
          >
            {submitError}
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6 rounded-xl border bg-white p-6 shadow-sm"
        >
          <div>
            <label
              htmlFor="title"
              className="mb-2 block text-sm font-medium text-gray-900"
            >
              Title
            </label>

            <input
              id="title"
              type="text"
              {...register("title")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              placeholder="e.g. Summer TikTok Campaign"
              disabled={isSubmitting}
            />

            {errors.title ? (
              <p className="mt-1 text-sm text-red-600">
                {errors.title.message}
              </p>
            ) : null}
          </div>

          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-gray-900">
              Platforms
            </legend>

            <div className="space-y-2">
              {platforms.map((platform) => (
                <label
                  key={platform.value}
                  className="flex items-center gap-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    value={platform.value}
                    {...register("platforms")}
                    disabled={isSubmitting}
                    className="h-4 w-4 rounded border-gray-300"
                  />

                  <span>{platform.label}</span>
                </label>
              ))}
            </div>

            {errors.platforms ? (
              <p className="mt-1 text-sm text-red-600">
                {errors.platforms.message}
              </p>
            ) : null}
          </fieldset>

          <div>
            <label
              htmlFor="payoutPer1kViews"
              className="mb-2 block text-sm font-medium text-gray-900"
            >
              Payout per 1,000 views (cents)
            </label>

            <input
              id="payoutPer1kViews"
              type="number"
              min="1"
              step="1"
              {...register("payoutPer1kViews", {
                valueAsNumber: true,
              })}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />

            <p className="mt-1 text-xs text-gray-500">
              Example: 500 = 5.00 in the campaign currency.
            </p>

            {errors.payoutPer1kViews ? (
              <p className="mt-1 text-sm text-red-600">
                {errors.payoutPer1kViews.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="totalBudget"
              className="mb-2 block text-sm font-medium text-gray-900"
            >
              Total budget (cents)
            </label>

            <input
              id="totalBudget"
              type="number"
              min="1"
              step="1"
              {...register("totalBudget", {
                valueAsNumber: true,
              })}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />

            <p className="mt-1 text-xs text-gray-500">
              Example: 10000 = 100.00 in the campaign currency.
            </p>

            {errors.totalBudget ? (
              <p className="mt-1 text-xs text-gray-500">
                Example: 10000 = 100.00 in the campaign currency.
              </p>
            ) : null}

            {errors.totalBudget ? (
              <p className="mt-1 text-sm text-red-600">
                {errors.totalBudget.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="status"
              className="mb-2 block text-sm font-medium text-gray-900"
            >
              Status
            </label>

            <select
              id="status"
              {...register("status")}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            >
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            {errors.status ? (
              <p className="mt-1 text-sm text-red-600">
                {errors.status.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="startsAt"
              className="mb-2 block text-sm font-medium text-gray-900"
            >
              Starts at
            </label>

            <input
              id="startsAt"
              type="datetime-local"
              {...register("startsAt")}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />

            {errors.startsAt ? (
              <p className="mt-1 text-sm text-red-600">
                {errors.startsAt.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="endsAt"
              className="mb-2 block text-sm font-medium text-gray-900"
            >
              Ends at
            </label>

            <input
              id="endsAt"
              type="datetime-local"
              {...register("endsAt")}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />

            {errors.endsAt ? (
              <p className="mt-1 text-sm text-red-600">
                {errors.endsAt.message}
              </p>
            ) : null}

            <p className="mt-1 text-xs text-gray-500">
              End date must be after the start date.
            </p>
          </div>

          <div className="flex gap-3 border-t pt-6">
            <button
              type="button"
              onClick={() => router.push(`/admin/campaigns/${campaignId}`)}
              disabled={isSubmitting}
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
