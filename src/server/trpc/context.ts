import { cookies } from "next/headers";

import { db } from "@/db";
import { users } from "@/db/schema";
import { verifySessionToken, SESSION_COOKIE } from "../auth/session";
import { eq } from "drizzle-orm";

export async function createTRPCContext() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  let user = null;

  if (sessionToken) {
    const session = await verifySessionToken(sessionToken);

    if (session) {
      user =
        (await db.query.users.findFirst({
          where: eq(users.id, session.userId),
        })) ?? null;
    }
  }

  return {
    db,
    user,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
