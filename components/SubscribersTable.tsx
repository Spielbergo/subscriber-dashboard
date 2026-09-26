"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { SubscriberRow } from "@/lib/metrics";

function StatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return <span className="text-xs text-muted">-</span>;
  }
  const styles: Record<string, string> = {
    active: "bg-success/10 text-success",
    trialing: "bg-accent/10 text-accent",
    canceled: "bg-danger/10 text-danger",
    past_due: "bg-warning/10 text-warning",
  };
  const style = styles[status] ?? "bg-surface-2 text-muted";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}

function SourceBadge({ label, source }: { label: string; source: string | null }) {
  if (!source) return <span className="text-xs text-muted">-</span>;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{source}</span>
    </div>
  );
}

function UtmPill({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
      {value}
    </span>
  );
}

export function SubscribersTable({ rows }: { rows: SubscriberRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [
        r.fullName,
        r.email,
        ...r.companyNames,
        r.plan,
        r.firstTouchSource,
        r.signupTouchSource,
        r.signupUtmSource,
        r.signupUtmMedium,
        r.signupUtmCampaign,
        r.signupUtmContent,
        r.signupUtmTerm,
        r.signupReferrer,
      ]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    );
  }, [rows, query]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">
          Subscribers <span className="text-muted">({filtered.length})</span>
        </h2>
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, source, UTM…"
            className="w-64 rounded-lg border border-border bg-bg py-1.5 pl-8 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="pb-2 pr-4 font-medium">Name</th>
              <th className="pb-2 pr-4 font-medium">Company</th>
              <th className="pb-2 pr-4 font-medium">Email</th>
              <th className="pb-2 pr-4 font-medium">Plan</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 pr-4 font-medium">Joined</th>
              <th className="pb-2 pr-4 font-medium">First touch</th>
              <th className="pb-2 pr-4 font-medium">Signup touch</th>
              <th className="pb-2 pr-4 font-medium">UTM / Referrer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="py-2.5 pr-4 whitespace-nowrap">
                  {r.fullName || <span className="text-muted">-</span>}
                </td>
                <td className="py-2.5 pr-4 whitespace-nowrap">
                  {r.companyNames.length > 0 ? (
                    r.companyNames.join(", ")
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td className="py-2.5 pr-4 whitespace-nowrap text-muted">
                  {r.email || "-"}
                </td>
                <td className="py-2.5 pr-4 whitespace-nowrap capitalize">
                  {r.plan || "free"}
                </td>
                <td className="py-2.5 pr-4 whitespace-nowrap">
                  <StatusBadge status={r.status} />
                </td>
                <td className="py-2.5 pr-4 whitespace-nowrap text-muted">
                  {new Date(r.joinedAt).toLocaleString()}
                </td>
                <td className="py-2.5 pr-4 whitespace-nowrap">
                  <SourceBadge label="First" source={r.firstTouchSource} />
                </td>
                <td className="py-2.5 pr-4 whitespace-nowrap">
                  <SourceBadge label="Signup" source={r.signupTouchSource} />
                </td>
                <td className="py-2.5 pr-4 min-w-[12rem]">
                  <div className="flex flex-wrap gap-1">
                    <UtmPill value={r.signupUtmSource} />
                    <UtmPill value={r.signupUtmMedium} />
                    <UtmPill value={r.signupUtmCampaign} />
                    <UtmPill value={r.signupUtmContent} />
                    <UtmPill value={r.signupUtmTerm} />
                    {r.signupReferrer && !r.signupUtmSource && (
                      <UtmPill value={r.signupReferrer} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-sm text-muted">
                  No matching subscribers.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
