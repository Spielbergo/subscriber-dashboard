import type { ActivityItem } from "@/lib/metrics";
import { UserPlus, RefreshCw } from "lucide-react";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">No activity yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2">
            {item.type === "signup" ? (
              <UserPlus size={14} className="text-success" />
            ) : (
              <RefreshCw size={14} className="text-accent" />
            )}
          </div>
          <div className="flex flex-1 flex-col">
            <span className="text-sm">{item.label}</span>
            <span className="text-xs text-muted">{item.maskedUser}</span>
          </div>
          <span className="whitespace-nowrap text-xs text-muted">
            {timeAgo(item.date)}
          </span>
        </li>
      ))}
    </ul>
  );
}
