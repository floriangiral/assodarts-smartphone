import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const ANNOUNCEMENT_LIMIT = 20;

export const loadPlatformAnnouncements = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign-in required");
  }

  const db = getFirestore();
  const [admin, memberships] = await Promise.all([
    db.collection("platform_admins").doc(request.auth.uid).get(),
    db.collection("memberships").where("authUid", "==", request.auth.uid).get(),
  ]);
  const canReadAdminAnnouncements =
    admin.exists ||
    memberships.docs.some((document) => {
      const membership = document.data();
      return (
        membership.status === "active" &&
        ["admin", "board"].includes(membership.role)
      );
    });
  const audiences = canReadAdminAnnouncements ? ["all", "admins"] : ["all"];
  const snapshots = await Promise.all(
    audiences.map((audience) =>
      db
        .collection("platform_announcements")
        .where("audience", "==", audience)
        .orderBy("publishedAt", "desc")
        .limit(ANNOUNCEMENT_LIMIT)
        .get(),
    ),
  );

  const announcements = snapshots
    .flatMap((snapshot) => snapshot.docs)
    .map((document) => {
      const data = document.data();
      return {
        id: document.id,
        title: data.title,
        body: data.body,
        audience: data.audience,
        publishedAtMillis:
          typeof data.publishedAt?.toMillis === "function"
            ? data.publishedAt.toMillis()
            : 0,
      };
    })
    .filter(
      (announcement) =>
        typeof announcement.title === "string" &&
        typeof announcement.body === "string" &&
        (announcement.audience === "all" || announcement.audience === "admins"),
    )
    .sort((left, right) => right.publishedAtMillis - left.publishedAtMillis)
    .slice(0, ANNOUNCEMENT_LIMIT);

  return { announcements };
});
