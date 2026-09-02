import { HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Throws unless the caller has an active admin or board membership for the
 * club. Money-moving endpoints must never rely on the client claiming a role;
 * this is looked up straight from Firestore with the Admin SDK.
 */
export async function requireClubBoard(clubId: string, uid: string): Promise<void> {
  const snap = await getFirestore()
    .collection("memberships")
    .doc(`${clubId}_${uid}`)
    .get();
  const membership = snap.data();

  if (!membership || membership.status !== "active" || !["admin", "board"].includes(membership.role)) {
    throw new HttpsError("permission-denied", "Only the club committee can do this");
  }
}
