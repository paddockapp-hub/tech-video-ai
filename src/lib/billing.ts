import type { MembershipTier } from "@/lib/db";

export type BillingCycle = "monthly" | "annual";

export const ANNUAL_DISCOUNT_PERCENT = 20;
export const MONTHLY_PERIOD_DAYS = 30;
export const ANNUAL_PERIOD_DAYS = 365;

export function isBillingCycle(value: unknown): value is BillingCycle {
  return value === "monthly" || value === "annual";
}

export function periodDaysForCycle(cycle: BillingCycle | undefined): number {
  return cycle === "annual" ? ANNUAL_PERIOD_DAYS : MONTHLY_PERIOD_DAYS;
}

export function quoteMembershipPrice(
  monthlyPriceKRW: number,
  cycle: BillingCycle = "monthly"
): { amountKRW: number; periodDays: number; discountPercent: number } {
  const monthly = Math.max(0, Math.round(monthlyPriceKRW || 0));
  if (cycle === "annual") {
    return {
      amountKRW: Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT_PERCENT / 100)),
      periodDays: ANNUAL_PERIOD_DAYS,
      discountPercent: ANNUAL_DISCOUNT_PERCENT,
    };
  }
  return {
    amountKRW: monthly,
    periodDays: MONTHLY_PERIOD_DAYS,
    discountPercent: 0,
  };
}

export function membershipQuoteMap(
  tierPricesKRW: Record<MembershipTier, number>
): Record<
  Exclude<MembershipTier, "free">,
  { monthly: number; annual: number }
> {
  const paid = ["basic", "standard", "premium"] as const;
  return paid.reduce(
    (acc, tier) => {
      acc[tier] = {
        monthly: quoteMembershipPrice(tierPricesKRW[tier], "monthly").amountKRW,
        annual: quoteMembershipPrice(tierPricesKRW[tier], "annual").amountKRW,
      };
      return acc;
    },
    {} as Record<Exclude<MembershipTier, "free">, { monthly: number; annual: number }>
  );
}

export function computeMembershipExpiry(
  currentExpiresAt: string | undefined,
  currentTier: MembershipTier,
  periodDays: number,
  now = new Date()
): Date {
  const existing = currentExpiresAt ? new Date(currentExpiresAt) : null;
  const shouldExtend =
    currentTier !== "free" && existing !== null && !Number.isNaN(existing.getTime()) && existing > now;
  const start = shouldExtend ? existing : now;
  const expires = new Date(start.getTime());
  expires.setDate(expires.getDate() + periodDays);
  return expires;
}
