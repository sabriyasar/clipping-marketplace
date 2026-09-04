"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE } from "@/server/auth/session";

export async function logout() {
  const cookieStore = await cookies();

  cookieStore.delete(SESSION_COOKIE);

  redirect("/dev-login");
}
