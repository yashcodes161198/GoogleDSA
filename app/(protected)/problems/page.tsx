import { ProblemsContent } from "@/components/ProblemsContent";
import { PracticeLibrary } from "@/components/SessionLibraryProvider";

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string }>;
}) {
  const params = await searchParams;
  return <PracticeLibrary><ProblemsContent added={params.added === "1"} /></PracticeLibrary>;
}
