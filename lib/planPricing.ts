/**
 * user_subscriptions.plan is just a text label - there's no price column
 * in the database. Map each plan name to its monthly price here so the
 * dashboard can estimate MRR. Update this whenever your pricing changes.
 *
 * IMPORTANT: keys must match the exact text stored in
 * user_subscriptions.plan, lowercased (the lookup below lowercases
 * whatever's in the database before checking this map). Open the
 * dashboard's "Plan distribution" chart to see the exact plan strings
 * your app is actually writing - e.g. it might be "pro_plus", "pro plus",
 * or "Pro Plus" depending on how your signup flow stores it - then match
 * that here.
 */
export const PLAN_PRICING: Record<string, number> = {
  free: 0,
  pro: 9,
  "pro plus": 15,
};

export function priceForPlan(plan: string): number {
  return PLAN_PRICING[plan.toLowerCase()] ?? 0;
}
