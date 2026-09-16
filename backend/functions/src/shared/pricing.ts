/**
 * Annual, degressive pricing for a club's own Assodarts subscription.
 *
 * IMPORTANT — these tiers are duplicated in Swift in
 * `ios-assodarts/Assodarts/Models/Club.swift` (`PricingTier.all`). The two
 * definitions must be kept in sync by hand; same constraint as the shared
 * shapes documented in `backend/types.ts`. The app only ever *displays* a
 * price, every amount actually charged is computed here.
 */
export interface PricingTier {
  id: string;
  priceEuros: number;
  upperBound: number;
}

export const PRICING_TIERS: readonly PricingTier[] = [
  { id: "essentiel", priceEuros: 49, upperBound: 20 },
  { id: "club", priceEuros: 89, upperBound: 50 },
  { id: "federal", priceEuros: 149, upperBound: 100 },
  { id: "ligue", priceEuros: 229, upperBound: 200 },
  // Above 200 members the price is negotiated, so there is nothing to charge
  // automatically: `priceEuros: 0` marks "quote only", not "free".
  { id: "devis", priceEuros: 0, upperBound: Number.MAX_SAFE_INTEGER },
];

export function tierForMemberCount(count: number): PricingTier {
  return (
    PRICING_TIERS.find((tier) => count <= tier.upperBound) ??
    PRICING_TIERS[PRICING_TIERS.length - 1]
  );
}

export function tierPriceCents(tier: PricingTier): number {
  return tier.priceEuros * 100;
}
