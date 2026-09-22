import { initializeApp } from "firebase-admin/app";

initializeApp();

export { stripeConnectOnboard } from "./stripeConnectOnboard";
export { stripeConnectStatus } from "./stripeConnectStatus";
export { stripeCreateCheckout } from "./stripeCreateCheckout";
export { stripeCreateClubSubscriptionCheckout } from "./stripeCreateClubSubscriptionCheckout";
export { stripeCreateClubBillingPortal } from "./stripeCreateClubBillingPortal";
export { checkTrialExpirations } from "./checkTrialExpirations";
export { stripeReturn } from "./stripeReturn";
export { stripeWebhook } from "./stripeWebhook";
export {
  declarePayment,
  validatePayment,
  cancelPaymentDeclaration,
} from "./paymentActions";
export { createPaymentCall } from "./paymentCalls";
export {
  onPaymentItemWritten,
  onAnnouncementCreated,
  onEventCreated,
  onMessageCreated,
  onTournamentEntryCreated,
  onPlatformAnnouncementCreated,
  onNotificationCreated,
} from "./notifications";
export {
  createInvitation,
  revokeInvitation,
  acceptInvitation,
} from "./invitations";
export { clubRoster } from "./clubRoster";
export { createClub } from "./createClub";
export { updateMemberProfile } from "./memberProfile";
export { sendMailOnCreate } from "./triggers/sendMailOnCreate";
export {
  platformAdminExists,
  claimPlatformAdmin,
  broadcastAnnouncement,
  createCoupon,
  deleteCoupon,
} from "./platformAdmin";
