"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { campaignFormSchema } from "@/modules/campaigns/campaign.validation";
import { createClient } from "@/trpc/client";

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

export default function CampaignForm() {
  const router = useRouter();
  const trpc = createClient();

  const {
    register,
    handleSubmit,
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
    },
  });

  const onSubmit = async (data: z.output<typeof campaignFormSchema>) => {
    try {
      await trpc.campaign.create.mutate(data);

      router.push("/admin");
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Campaign could not be created.");
    }
  };

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-8">
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="mb-4 text-sm text-gray-600 hover:text-gray-900"
        >
          ← Back to campaigns
        </button>

        <h1 className="text-2xl font-semibold">Create Campaign</h1>

        <p className="mt-2 text-sm text-gray-600">
          Create a campaign for creators to submit clips.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label htmlFor="title" className="mb-2 block text-sm font-medium">
            Title
          </label>

          <input
            id="title"
            type="text"
            {...register("title")}
            className="w-full rounded-md border px-3 py-2"
            placeholder="e.g. Summer TikTok Campaign"
          />

          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
          )}
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium">Platforms</span>

          <div className="space-y-2">
            {platforms.map((platform) => (
              <label key={platform.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  value={platform.value}
                  {...register("platforms")}
                />

                <span className="text-sm">{platform.label}</span>
              </label>
            ))}
          </div>

          {errors.platforms && (
            <p className="mt-1 text-sm text-red-600">
              {errors.platforms.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="payoutPer1kViews"
            className="mb-2 block text-sm font-medium"
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
            className="w-full rounded-md border px-3 py-2"
          />

          <p className="mt-1 text-xs text-gray-500">
            Example: 500 = 5.00 in the campaign currency.
          </p>

          {errors.payoutPer1kViews && (
            <p className="mt-1 text-sm text-red-600">
              {errors.payoutPer1kViews.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="totalBudget"
            className="mb-2 block text-sm font-medium"
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
            className="w-full rounded-md border px-3 py-2"
          />

          <p className="mt-1 text-xs text-gray-500">
            Example: 10000 = 100.00 in the campaign currency.
          </p>

          {errors.totalBudget && (
            <p className="mt-1 text-sm text-red-600">
              {errors.totalBudget.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="status" className="mb-2 block text-sm font-medium">
            Status
          </label>

          <select
            id="status"
            {...register("status")}
            className="w-full rounded-md border px-3 py-2"
          >
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          {errors.status && (
            <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="startsAt" className="mb-2 block text-sm font-medium">
            Starts at
          </label>

          <input
            id="startsAt"
            type="datetime-local"
            {...register("startsAt")}
            className="w-full rounded-md border px-3 py-2"
          />

          {errors.startsAt && (
            <p className="mt-1 text-sm text-red-600">
              {errors.startsAt.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="endsAt" className="mb-2 block text-sm font-medium">
            Ends at
          </label>

          <input
            id="endsAt"
            type="datetime-local"
            {...register("endsAt")}
            className="w-full rounded-md border px-3 py-2"
          />

          {errors.endsAt && (
            <p className="mt-1 text-sm text-red-600">{errors.endsAt.message}</p>
          )}
        </div>

        <div className="flex gap-3 border-t pt-6">
          <button
            type="button"
            onClick={() => router.push("/admin")}
            disabled={isSubmitting}
            className="rounded-md border px-4 py-2 text-sm"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Campaign"}
          </button>
        </div>
      </form>
    </main>
  );
}
