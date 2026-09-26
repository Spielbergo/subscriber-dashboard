import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";
import { priceForPlan } from "./planPricing";

export type ActivityItem = {
  id: string;
  type: "signup" | "status_change";
  label: string; // human-readable, no personal data
  maskedUser: string;
  date: string; // ISO string
};

export type SubscriberRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  companyNames: string[];
  plan: string | null;
  status: string | null;
  joinedAt: string;
  renewsAt: string | null;
  firstTouchSource: string | null;
  signupTouchSource: string | null;
  signupUtmSource: string | null;
  signupUtmMedium: string | null;
  signupUtmCampaign: string | null;
  signupUtmContent: string | null;
  signupUtmTerm: string | null;
  signupReferrer: string | null;
};

export type Metrics = {
  totalUsers: number;
  totalCompanies: number;
  avgCompaniesPerUser: number;
  subscribers: {
    total: number;
    byStatus: Record<string, number>;
    byPlan: Record<string, number>;
    series: { date: string; free: number; pro: number; "pro plus": number }[];
  };
  mrr: number;
  signups: {
    last7Days: number;
    last30Days: number;
    series: { date: string; count: number }[]; // daily, last 30 days
  };
  cancellations: {
    last30Days: number;
    series: { date: string; count: number }[]; // daily, last 30 days (approx, based on updated_at)
  };
  upcomingRenewals: { maskedUser: string; plan: string; date: string }[];
  recentActivity: ActivityItem[];
  subscriberList: SubscriberRow[];
  generatedAt: string;
};

function maskId(id: string): string {
  return `user_${id.replace(/-/g, "").slice(0, 8)}`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function normalizePlan(plan: string | null): string {
  if (!plan || plan.toLowerCase() === "free") return "free";
  return plan.toLowerCase();
}

function buildDailySeries(
  dates: Date[],
  days: number
): { date: string; count: number }[] {
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(isoDate(d), 0);
  }
  for (const d of dates) {
    const key = isoDate(d);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({
    date,
    count,
  }));
}

function buildSubscriberSeries(
  profiles: { id: string; created_at: string }[],
  subs: {
    user_id: string;
    plan: string | null;
    status: string;
    created_at: string;
  }[],
  days: number
): { date: string; free: number; pro: number; "pro plus": number }[] {
  const buckets = new Map<string, { free: number; pro: number; "pro plus": number }>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(isoDate(d), { free: 0, pro: 0, "pro plus": 0 });
  }

  const activeStatuses = new Set(["active", "trialing"]);
  const paidUsers = new Map<
    string,
    { plan: string; start: string }
  >();

  for (const s of subs) {
    if (!activeStatuses.has(s.status)) continue;
    const plan = normalizePlan(s.plan);
    if (plan === "free") continue;
    paidUsers.set(s.user_id, { plan, start: isoDate(new Date(s.created_at)) });
  }

  for (const [dateStr] of buckets) {
    const date = new Date(dateStr);

    let free = 0;
    for (const p of profiles) {
      if (new Date(p.created_at) <= date && !paidUsers.has(p.id)) {
        free++;
      }
    }

    let pro = 0;
    let proPlus = 0;
    for (const [, { plan, start }] of paidUsers) {
      if (new Date(start) <= date) {
        if (plan === "pro") pro++;
        else if (plan === "pro plus") proPlus++;
      }
    }

    buckets.set(dateStr, { free, pro, "pro plus": proPlus });
  }

  return Array.from(buckets.entries()).map(([date, counts]) => ({
    date,
    ...counts,
  }));
}

export async function getMetrics(): Promise<Metrics> {
  const supabase = createSupabaseAdminClient();

  // Personal columns (email, full_name, company name) are now included -
  // this is an internal, admin-only view of your own product's users,
  // not a public surface.
  const [profilesRes, subsRes, companiesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, email, full_name, created_at, first_touch_source, signup_touch_source, signup_utm_source, signup_utm_medium, signup_utm_campaign, signup_utm_content, signup_utm_term, signup_referrer"
      ),
    supabase
      .from("user_subscriptions")
      .select(
        "id, user_id, plan, status, current_period_end, created_at, updated_at"
      ),
    supabase.from("companies").select("id, user_id, name, created_at"),
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (subsRes.error) throw subsRes.error;
  if (companiesRes.error) throw companiesRes.error;

  const profiles = profilesRes.data ?? [];
  const subs = subsRes.data ?? [];
  const companies = companiesRes.data ?? [];

  const totalUsers = profiles.length;
  const totalCompanies = companies.length;
  const avgCompaniesPerUser = totalUsers > 0 ? totalCompanies / totalUsers : 0;

  const activeStatuses = new Set(["active", "trialing"]);

  const byStatus: Record<string, number> = {};
  const byPlan: Record<string, number> = {};
  let mrr = 0;
  let activeCount = 0;

  // Count every subscription row in plan distribution, including canceled,
  // past_due, etc. Missing plan values are treated as free.
  const subscribedUserIds = new Set<string>();
  for (const s of subs) {
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    const plan = normalizePlan(s.plan);
    byPlan[plan] = (byPlan[plan] ?? 0) + 1;
    subscribedUserIds.add(s.user_id);
    if (activeStatuses.has(s.status)) {
      mrr += priceForPlan(s.plan);
      activeCount += 1;
    }
  }

  // Users with no subscription row are also free users.
  const unsubscribedCount = profiles.filter(
    (p) => !subscribedUserIds.has(p.id)
  ).length;
  if (unsubscribedCount > 0) {
    byPlan["free"] = (byPlan["free"] ?? 0) + unsubscribedCount;
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const signupDates = profiles.map((p) => new Date(p.created_at));
  const signupsLast7 = signupDates.filter((d) => d >= sevenDaysAgo).length;
  const signupsLast30 = signupDates.filter((d) => d >= thirtyDaysAgo).length;
  const signupSeries = buildDailySeries(signupDates, 30);

  // Approximation: no dedicated canceled_at column exists, so a
  // cancellation is inferred from status === 'canceled' using the row's
  // updated_at as a proxy for "when it was canceled".
  const canceledDates = subs
    .filter((s) => s.status === "canceled")
    .map((s) => new Date(s.updated_at));
  const cancellationsLast30 = canceledDates.filter(
    (d) => d >= thirtyDaysAgo
  ).length;
  const cancellationSeries = buildDailySeries(canceledDates, 30);
  const subscriberSeries = buildSubscriberSeries(profiles, subs, 30);

  const inSevenDays = new Date(now);
  inSevenDays.setDate(now.getDate() + 7);
  const upcomingRenewals = subs
    .filter(
      (s) =>
        activeStatuses.has(s.status) &&
        s.current_period_end &&
        new Date(s.current_period_end) <= inSevenDays &&
        new Date(s.current_period_end) >= now
    )
    .sort(
      (a, b) =>
        new Date(a.current_period_end!).getTime() -
        new Date(b.current_period_end!).getTime()
    )
    .map((s) => ({
      maskedUser: maskId(s.user_id),
      plan: s.plan,
      date: s.current_period_end!,
    }));

  const signupActivity: ActivityItem[] = profiles
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 15)
    .map((p) => ({
      id: `signup-${p.id}`,
      type: "signup",
      label: "New signup",
      maskedUser: maskId(p.id),
      date: p.created_at,
    }));

  const statusActivity: ActivityItem[] = subs
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 15)
    .map((s) => ({
      id: `status-${s.id}-${s.updated_at}`,
      type: "status_change",
      label: `Subscription ${s.status} (${s.plan})`,
      maskedUser: maskId(s.user_id),
      date: s.updated_at,
    }));

  const recentActivity = [...signupActivity, ...statusActivity]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  // Latest subscription per user (in case of historical rows).
  const latestSubByUser = new Map<string, (typeof subs)[number]>();
  for (const s of subs) {
    const existing = latestSubByUser.get(s.user_id);
    if (!existing || new Date(s.updated_at) > new Date(existing.updated_at)) {
      latestSubByUser.set(s.user_id, s);
    }
  }

  const companyNamesByUser = new Map<string, string[]>();
  for (const c of companies) {
    const list = companyNamesByUser.get(c.user_id) ?? [];
    list.push(c.name);
    companyNamesByUser.set(c.user_id, list);
  }

  const subscriberList: SubscriberRow[] = profiles
    .map((p) => {
      const sub = latestSubByUser.get(p.id);
      return {
        id: p.id,
        email: p.email,
        fullName: p.full_name,
        companyNames: companyNamesByUser.get(p.id) ?? [],
        plan: sub?.plan ?? null,
        status: sub?.status ?? null,
        joinedAt: p.created_at,
        renewsAt: sub?.current_period_end ?? null,
        firstTouchSource: p.first_touch_source,
        signupTouchSource: p.signup_touch_source,
        signupUtmSource: p.signup_utm_source,
        signupUtmMedium: p.signup_utm_medium,
        signupUtmCampaign: p.signup_utm_campaign,
        signupUtmContent: p.signup_utm_content,
        signupUtmTerm: p.signup_utm_term,
        signupReferrer: p.signup_referrer,
      };
    })
    .sort(
      (a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
    );

  return {
    totalUsers,
    totalCompanies,
    avgCompaniesPerUser,
    subscribers: {
      total: activeCount,
      byStatus,
      byPlan,
      series: subscriberSeries,
    },
    mrr,
    signups: {
      last7Days: signupsLast7,
      last30Days: signupsLast30,
      series: signupSeries,
    },
    cancellations: {
      last30Days: cancellationsLast30,
      series: cancellationSeries,
    },
    upcomingRenewals,
    recentActivity,
    subscriberList,
    generatedAt: now.toISOString(),
  };
}
