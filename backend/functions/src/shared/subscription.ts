import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import {
  tierForMemberCount,
  tierPriceCents,
  type PricingTier,
} from "./pricing";

/**
 * How long a club keeps working after Stripe reports a failed renewal, before
 * the scheduled job downgrades it to `expired`.
 *
 * Product decision, deliberately a named constant so it can be reviewed and
 * changed in one place: Stripe's own dunning retries a failed card for about a
 * week, so expiring earlier would cut off clubs Stripe is still trying to
 * charge.
 */
export const GRACE_PERIOD_DAYS = 7;

/** Stripe subscription statuses that mean "this club already pays us". */
export const LIVE_STRIPE_STATUSES: readonly Stripe.Subscription.Status[] = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
];

/** Billable head count: only active memberships are charged for. */
export async function activeMemberCount(clubId: string): Promise<number> {
  const snapshot = await getFirestore()
    .collection("memberships")
    .where("clubId", "==", clubId)
    .where("status", "==", "active")
    .get();
  return snapshot.size;
}

export async function tierForClub(clubId: string): Promise<PricingTier> {
  return tierForMemberCount(await activeMemberCount(clubId));
}

/**
 * The club's own coupon, when it is still valid today and actually targets
 * this club. `clubIds` empty means "every club".
 */
export async function activeCouponForClub(
  clubId: string,
  code: string | null | undefined,
): Promise<{
  code: string;
  percent: number;
  autoRenew: boolean;
} | null> {
  if (!code) return null;

  const snapshot = await getFirestore()
    .collection("coupons")
    .where("code", "==", code)
    .limit(1)
    .get();
  if (snapshot.empty) return null;

  const coupon = snapshot.docs[0].data();
  const expiresAt = coupon.expiresAt?.toDate?.() ?? new Date(coupon.expiresAt);
  if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) {
    return null;
  }
  if (expiresAt.getTime() < Date.now()) return null;

  const clubIds: string[] = Array.isArray(coupon.clubIds) ? coupon.clubIds : [];
  if (clubIds.length > 0 && !clubIds.includes(clubId)) return null;

  const percent = Number(coupon.percent);
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) return null;

  return { code: String(coupon.code), percent, autoRenew: !!coupon.autoRenew };
}

/**
 * Mirrors one of our coupons into Stripe so the discount is applied by Stripe
 * itself rather than baked into the price.
 *
 * `autoRenew` decides the Stripe duration: a non-renewing coupon is a welcome
 * gesture on the first year only (`once`), a renewing one is a standing
 * agreement (`forever`). The Stripe coupon id encodes both the percentage and
 * the duration, so changing either produces a different Stripe object instead
 * of silently reusing a stale one.
 */
export async function ensureStripeCoupon(
  stripe: Stripe,
  coupon: { code: string; percent: number; autoRenew: boolean },
): Promise<string> {
  const duration: Stripe.CouponCreateParams.Duration = coupon.autoRenew
    ? "forever"
    : "once";
  const id = `assodarts_${coupon.code}_${coupon.percent}_${duration}`;

  try {
    await stripe.coupons.retrieve(id);
    return id;
  } catch {
    const created = await stripe.coupons.create({
      id,
      percent_off: coupon.percent,
      duration,
      name: `Assodarts ${coupon.code}`,
      metadata: { assodarts_code: coupon.code },
    });
    return created.id;
  }
}

export { tierForMemberCount, tierPriceCents };
