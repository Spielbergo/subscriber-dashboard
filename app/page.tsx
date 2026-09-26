"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchMetricsClient,
  NotAuthenticatedError,
  NotAuthorizedError,
} from "@/lib/fetchMetricsClient";
import { DashboardShell } from "@/components/DashboardShell";
import type { Metrics } from "@/lib/metrics";

export default function DashboardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await fetchMetricsClient();
        if (active) setMetrics(data);
      } catch (err) {
        if (err instanceof NotAuthenticatedError) {
          router.replace("/login");
          return;
        }
        if (err instanceof NotAuthorizedError) {
          const supabase = createSupabaseBrowserClient();
          await supabase.auth.signOut();
          router.replace("/login?error=not_authorized");
          return;
        }
        if (active) setError(err instanceof Error ? err.message : "Couldn't load metrics.");
        console.error(err);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-danger">
        {error}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Loading…
      </div>
    );
  }

  return <DashboardShell initial={metrics} />;
}
