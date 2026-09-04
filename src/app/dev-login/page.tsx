import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { createSessionToken, SESSION_COOKIE } from "@/server/auth/session";

async function loginAs(formData: FormData) {
  "use server";

  if (process.env.NODE_ENV === "production") {
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
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/");
}

export default async function DevLoginPage() {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const users = await db.select().from((await import("@/db/schema")).users);

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">Development Login</h1>

      <div className="space-y-4">
        {users.map((user) => (
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
