import { messages } from "../../../lib/messages";
export default async function Club({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <main><h1>{messages.club}</h1><p>{slug}</p></main>;
}
