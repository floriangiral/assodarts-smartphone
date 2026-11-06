import { notFound } from "next/navigation";
import AdminWorkspace from "@/components/admin/workspace";
import { parseWorkspacePath } from "@/lib/admin/navigation";

export default async function WorkspaceSection({ params }: { params: Promise<{ section: string[] }> }) {
  const { section } = await params;
  if (section.length === 1 && section[0] === "plateforme") return <AdminWorkspace space="platform" />;
  if (section.length === 1 && section[0] === "site") return <AdminWorkspace space="site" />;
  if (!parseWorkspacePath(`/${section.map(encodeURIComponent).join("/")}`)) notFound();
  return <AdminWorkspace />;
}
