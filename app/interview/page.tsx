import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { StartInterviewButton } from "@/components/StartInterviewButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveInterviewSession, getInterviewSessions } from "@/lib/data";

export default async function InterviewPage() {
  const [active, sessions] = await Promise.all([
    getActiveInterviewSession(),
    getInterviewSessions(),
  ]);

  if (active) {
    redirect(`/interview/${active.id}`);
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Mock interview</h1>
          <p className="mt-1 text-zinc-500">
            Simulate a 2-hour Google-style coding interview with 5 problems
          </p>
        </div>

        <StartInterviewButton />

        <Card>
          <CardHeader>
            <CardTitle>Recent sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-sm text-zinc-500">No interviews yet.</p>
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/interview/${s.id}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    >
                      <span>
                        {new Date(s.started_at).toLocaleString()}
                      </span>
                      <span className="text-sm capitalize text-zinc-500">{s.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
