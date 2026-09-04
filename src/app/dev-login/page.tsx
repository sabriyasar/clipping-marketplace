import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { users } from "@/db/schema";
import { createSessionToken, SESSION_COOKIE } from "@/server/auth/session";

// This page reads the live user list on every request. Without this,
// Next.js prerenders it once at build time and serves a stale snapshot
// from the CDN until the next deploy, which made dev/test-only users
// appear to "come back" after a refresh even though they'd been
// deleted from the database.
export const dynamic = "force-dynamic";

const isDemoLoginEnabled =
  process.env.NODE_ENV !== "production" ||
  process.env.DEMO_LOGIN_ENABLED === "true";

async function loginAs(formData: FormData) {
  "use server";

  if (!isDemoLoginEnabled) {
    redirect("/");
  }

  const userId = formData.get("userId");

  if (typeof userId !== "string" || !userId) {
    redirect("/dev-login");
  }

  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, userId),
  });

  if (!user) {
    redirect("/dev-login");
  }

  const token = await createSessionToken(user.id);

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/");
}

export default async function DevLoginPage() {
  if (!isDemoLoginEnabled) {
    return null;
  }

  const userList = await db.select().from(users);

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">Development Login</h1>

      <div className="space-y-4">
        {userList.map((user) => (
          <form action={loginAs} key={user.id}>
            <input type="hidden" name="userId" value={user.id} />

            <button
              type="submit"
              className="w-full rounded-md border p-4 text-left hover:bg-gray-50"
            >
              <div className="font-medium">{user.email}</div>
              <div className="text-sm text-gray-500">{user.role}</div>
            </button>
          </form>
        ))}
      </div>
    </main>
  );
}
