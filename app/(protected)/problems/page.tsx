import { ProblemTable } from "@/components/ProblemTable";
import { getProblemsWithProgress } from "@/lib/data";

export default async function ProblemsPage() {
  const problems = await getProblemsWithProgress();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Problems</h1>
        <p className="mt-1 text-zinc-500">
          Track progress across all Google interview questions
        </p>
      </div>
      <ProblemTable problems={problems} />
    </div>
  );
}
