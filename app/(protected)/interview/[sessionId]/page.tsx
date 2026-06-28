import { notFound } from "next/navigation";
import { InterviewSessionView } from "@/components/InterviewSessionView";
import { getInterviewSession } from "@/lib/data";

export default async function InterviewSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const data = await getInterviewSession(sessionId);

  if (!data) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Interview session</h1>
        <p className="mt-1 text-zinc-500">
          Started {new Date(data.session.started_at).toLocaleString()} ·{" "}
          <span className="capitalize">{data.session.status}</span>
        </p>
      </div>
      <InterviewSessionView session={data.session} problems={data.problems} />
    </div>
  );
}
