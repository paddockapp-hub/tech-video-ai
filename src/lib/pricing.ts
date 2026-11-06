import { CLIP_DURATION_SEC, CREDITS_PER_CLIP, CREDIT_COST_KRW } from "@/types";

export const DURATION_PACKS = [15, 30, 45, 60, 90, 120] as const;

const PRICE_TABLE: Record<number, number> = {
  15: 4900,
  30: 8900,
  45: 12900,
  60: 15900,
  90: 22900,
  120: 29900,
};

export function quoteOrder(durationSec: number) {
  const pack = DURATION_PACKS.includes(durationSec as (typeof DURATION_PACKS)[number])
    ? durationSec
    : 60;
  const clipCount = Math.ceil(pack / CLIP_DURATION_SEC);
  const vendorCostKRW = Math.round(clipCount * CREDITS_PER_CLIP * CREDIT_COST_KRW);
  const priceKRW = PRICE_TABLE[pack] ?? 15900;

  return {
    durationSec: pack,
    clipCount,
    vendorCostKRW,
    priceKRW,
    label: `${pack}초 쇼츠`,
  };
}
