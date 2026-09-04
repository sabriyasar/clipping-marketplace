import {
  adminProcedure,
  creatorProcedure,
  publicProcedure,
  router,
} from "./init";

import {
  campaignIdSchema,
  campaignListSchema,
  createCampaignSchema,
  updateCampaignSchema,
} from "@/modules/campaigns/campaign.validation";

import {
  createCampaign,
  getActiveCampaignById,
  getCampaignById,
  getCampaignOverview,
  listActiveCampaigns,
  listCampaigns,
  updateCampaign,
} from "@/modules/campaigns/campaign.service";

import {
  createSubmissionSchema,
  reviewSubmissionSchema,
} from "@/modules/submissions/submission.validation";

import {
  approveSubmission,
  createSubmission,
  listMySubmissions,
  listSubmissionsByCampaign,
  rejectSubmission,
} from "@/modules/submissions/submission.service";

export const appRouter = router({
  health: publicProcedure.query(() => {
    return {
      ok: true,
    };
  }),

  me: publicProcedure.query(({ ctx }) => {
    return ctx.user;
  }),

  adminOnly: adminProcedure.query(({ ctx }) => {
    return {
      email: ctx.user.email,
      role: ctx.user.role,
    };
  }),

  creatorOnly: creatorProcedure.query(({ ctx }) => {
    return {
      email: ctx.user.email,
      role: ctx.user.role,
    };
  }),

  campaign: router({
    list: adminProcedure.input(campaignListSchema).query(({ ctx, input }) => {
      return listCampaigns(ctx.db, input);
    }),

    active: creatorProcedure.query(({ ctx }) => {
      return listActiveCampaigns(ctx.db);
    }),

    activeById: creatorProcedure
      .input(campaignIdSchema)
      .query(({ ctx, input }) => {
        return getActiveCampaignById(ctx.db, input.id);
      }),

    getById: adminProcedure.input(campaignIdSchema).query(({ ctx, input }) => {
      return getCampaignById(ctx.db, input.id);
    }),

    overview: adminProcedure.input(campaignIdSchema).query(({ ctx, input }) => {
      return getCampaignOverview(ctx.db, input.id);
    }),

    create: adminProcedure
      .input(createCampaignSchema)
      .mutation(({ ctx, input }) => {
        return createCampaign(ctx.db, input);
      }),

    update: adminProcedure
      .input(updateCampaignSchema)
      .mutation(({ ctx, input }) => {
        return updateCampaign(ctx.db, input);
      }),
  }),

  submission: router({
    create: creatorProcedure
      .input(createSubmissionSchema)
      .mutation(({ ctx, input }) => {
        return createSubmission(ctx.db, ctx.user.id, input);
      }),

    my: creatorProcedure.query(({ ctx }) => {
      return listMySubmissions(ctx.db, ctx.user.id);
    }),

    listByCampaign: adminProcedure
      .input(campaignIdSchema)
      .query(({ ctx, input }) => {
        return listSubmissionsByCampaign(ctx.db, input.id);
      }),

    review: adminProcedure
      .input(reviewSubmissionSchema)
      .mutation(({ ctx, input }) => {
        if (input.action === "approve") {
          return approveSubmission(ctx.db, input.submissionId);
        }

        return rejectSubmission(
          ctx.db,
          input.submissionId,
          input.rejectionReason!,
        );
      }),
  }),
});

export type AppRouter = typeof appRouter;
