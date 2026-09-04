import { z } from "zod";

export const submissionPlatformSchema = z.enum([
  "tiktok",
  "instagram",
  "youtube",
]);

export const createSubmissionSchema = z.object({
  campaignId: z.string().uuid(),

  postUrl: z.string().trim().url().max(2048),

  platform: submissionPlatformSchema,
});

export const reviewSubmissionSchema = z
  .object({
    submissionId: z.string().uuid(),

    action: z.enum(["approve", "reject"]),

    rejectionReason: z.string().trim().max(1000).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.action === "reject" && !input.rejectionReason) {
      ctx.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "Rejection reason is required",
      });
    }
  });

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>;
