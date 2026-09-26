"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, LogOut, Users, DollarSign, TrendingDown, Building2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatCard } from "@/components/StatCard";
import { TrendChart } from "@/components/TrendChart";
import { PlanChart } from "@/components/PlanChart";
import { SubscriberTrendChart } from "@/components/SubscriberTrendChart";
import { ActivityFeed } from "@/components/ActivityFeed";
import { SubscribersTable } from "@/components/SubscribersTable";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchMetricsClient,
  NotAuthenticatedError,
  NotAuthorizedError,
} from "@/lib/fetchMetricsClient";
import type { Metrics } from "@/lib/metrics";

export function DashboardShell({ initial }: { initial: Metrics }) {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const data = await fetchMetricsClient();
      setMetrics(data);
      setRefreshError(null);
    } catch (err) {
      if (err instanceof NotAuthenticatedError) {
        router.replace("/login");
      } else if (err instanceof NotAuthorizedError) {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        router.replace("/login?error=not_authorized");
      } else {
        setRefreshError(
          err instanceof Error ? err.message : "Refresh failed. Check the console."
        );
        console.error(err);
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const generated = new Date(metrics.generatedAt);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Subscriber Dashboard</h1>
          <p className="text-sm text-muted">
            Updated {generated.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <ThemeToggle />
          <button
            onClick={handleSignOut}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text transition-colors hover:bg-surface-2"
            aria-label="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {refreshError && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
          {refreshError}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active subscribers"
          value={String(metrics.subscribers.total)}
          sub={`${metrics.totalUsers} total signups`}
          icon={Users}
        />
        <StatCard
          label="Estimated MRR"
          value={`$${metrics.mrr.toLocaleString()}`}
          sub="Based on your plan pricing config"
          icon={DollarSign}
        />
        <StatCard
          label="Cancellations (30d)"
          value={String(metrics.cancellations.last30Days)}
          sub="Approximate - no cancel timestamp in DB"
          icon={TrendingDown}
        />
        <StatCard
          label="Companies created"
          value={String(metrics.totalCompanies)}
          sub={`${metrics.avgCompaniesPerUser.toFixed(1)} avg per user`}
          icon={Building2}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium">Signups vs. cancellations (30d)</h2>
            <span className="text-xs text-muted">
              {metrics.signups.last7Days} signups in last 7 days
            </span>
          </div>
          <TrendChart
            signups={metrics.signups.series}
            cancellations={metrics.cancellations.series}
          />
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-medium">Plan distribution</h2>
          <PlanChart byPlan={metrics.subscribers.byPlan} />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium">Subscribers over time (30d)</h2>
          <span className="text-xs text-muted">
            free · pro · pro plus
          </span>
        </div>
        <SubscriberTrendChart series={metrics.subscribers.series} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 mt-4 h-96">
        <div className="rounded-2xl border border-border bg-surface p-5 lg:col-span-2 overflow-auto">
          <h2 className="mb-2 text-sm font-medium">Recent activity</h2>
          <ActivityFeed items={metrics.recentActivity} />
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 overflow-auto">
          <h2 className="mb-2 text-sm font-medium">Renewing in next 7 days</h2>
          {metrics.upcomingRenewals.length === 0 ? (
            <p className="text-sm text-muted">Nothing renewing soon.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {metrics.upcomingRenewals.map((r, i) => (
                <li key={i} className="flex items-center justify-between py-3">
                  <div className="flex flex-col">
                    <span className="text-sm">{r.maskedUser}</span>
                    <span className="text-xs text-muted">{r.plan}</span>
                  </div>
                  <span className="text-xs text-muted">
                    {new Date(r.date).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4">
        <SubscribersTable rows={metrics.subscriberList} />
      </div>
    </div>
  );
}
