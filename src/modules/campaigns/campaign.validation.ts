import { z } from "zod";

export const campaignStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "completed",
]);

export const platformSchema = z.enum(["tiktok", "instagram", "youtube"]);

export const campaignFormSchema = z
  .object({
    title: z.string().trim().min(1).max(200),

    platforms: z
      .array(platformSchema)
      .min(1)
      .refine((platforms) => new Set(platforms).size === platforms.length, {
        message: "Platforms must be unique",
      }),

    payoutPer1kViews: z.number().int().positive(),

    totalBudget: z.number().int().positive(),

    status: campaignStatusSchema,

    startsAt: z.coerce.date(),

    endsAt: z.coerce.date(),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "End date must be after start date",
    path: ["endsAt"],
  });

export const createCampaignSchema = campaignFormSchema;

export const updateCampaignSchema = campaignFormSchema.extend({
  id: z.string().uuid(),
});

export const campaignIdSchema = z.object({
  id: z.string().uuid(),
});

export const campaignListSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
  search: z.string().trim().optional(),
  status: campaignStatusSchema.optional(),
});

export type CampaignFormInput = z.infer<typeof campaignFormSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type CampaignListInput = z.infer<typeof campaignListSchema>;
export type CampaignIdInput = z.infer<typeof campaignIdSchema>;
