import { ImageResponse } from "next/og";
import { formatDate, getClub, getEvent } from "@/lib/public/data";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; eventId: string }> },
) {
  const { slug, eventId } = await params;
  const club = await getClub(
    slug,
    `/e/${encodeURIComponent(eventId)}/opengraph-image`,
  );
  const event = await getEvent(club.id, eventId);
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#15243a",
        color: "white",
        padding: 70,
        justifyContent: "center",
      }}
    >
      <div style={{ color: "#ff9b48", fontSize: 34 }}>{club.name}</div>
      <div style={{ fontSize: 64, fontWeight: 700, marginTop: 25 }}>
        {event.title}
      </div>
      <div style={{ fontSize: 30, marginTop: 30 }}>
        {formatDate(event.date)}
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
