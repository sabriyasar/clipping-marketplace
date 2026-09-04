import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { SESSION_COOKIE, verifySessionToken } from "@/server/auth/session";

export default async function Home() {
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
    where: (users, { eq }) => eq(users.id, session.userId),
  });

  if (!user) {
    redirect("/dev-login");
  }

  if (user.role === "admin") {
    redirect("/admin");
  }

  redirect("/creator");
}
