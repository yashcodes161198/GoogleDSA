import { ProblemsContent } from "@/components/ProblemsContent";

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string }>;
}) {
  const params = await searchParams;
  return <ProblemsContent added={params.added === "1"} />;
}
