import { AddQuestionForm } from "@/components/AddQuestionForm";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";

export default async function NewProblemPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/problems"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← Back to problems
        </Link>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Add question</h1>
        <p className="mt-1 text-zinc-500">
          Add a question to the shared library with its practice links and
          topics.
        </p>
      </div>
      <AddQuestionForm />
    </div>
  );
}
