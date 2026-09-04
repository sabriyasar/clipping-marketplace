import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import {
  SESSION_COOKIE,
  verifySessionToken,
} from "@/server/auth/session";

import CampaignForm from "./CampaignForm";

export default async function NewCampaignPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionToken) {
    redirect("/dev-login");
  }

  const session = await verifySessionToken(sessionToken);

  if (!session) {
    redirect("/dev-login");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  if (!user) {
    redirect("/dev-login");
  }

  if (user.role !== "admin") {
    redirect("/creator");
  }

  return <CampaignForm />;
}
