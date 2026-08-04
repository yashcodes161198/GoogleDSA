"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startInterviewSession } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function StartInterviewButton({
  hasActiveSession = false,
}: {
  hasActiveSession?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const start = () => {
    startTransition(async () => {
      try {
        const sessionId = await startInterviewSession(true);
        router.push(`/interview/${sessionId}`);
        router.refresh();
      } catch (err) {
        console.error("Failed to start interview:", err);
        alert(
          err instanceof Error
            ? err.message
            : "Failed to start interview. Please try again."
        );
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start a new interview</CardTitle>
        <CardDescription>
          5 problems · 2 hours · weighted by Google frequency with topic diversity
          {hasActiveSession && (
            <span className="mt-1 block text-amber-600">
              Starting a new interview will end your current active session.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button size="lg" onClick={start} disabled={pending}>
          {pending ? "Starting..." : "Start new interview"}
        </Button>
      </CardContent>
    </Card>
  );
}
