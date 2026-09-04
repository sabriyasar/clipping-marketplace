"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { useState } from "react";

import type { AppRouter } from "@/server/trpc/router";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export const createClient = () =>
  createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: "/api/trpc",
      }),
    ],
  });
