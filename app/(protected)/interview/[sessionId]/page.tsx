import { PageHeading } from "@/components/PageHeading";
import Link from "next/link";
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
      <PageHeading
        title="Interview session"
        description={`Started ${new Date(data.session.started_at).toLocaleString()} · ${data.session.status}`}
      >
        <Link href="/interview" className="button-link secondary">
          All interviews
        </Link>
      </PageHeading>
      <InterviewSessionView session={data.session} problems={data.problems} />
    </div>
  );
}
