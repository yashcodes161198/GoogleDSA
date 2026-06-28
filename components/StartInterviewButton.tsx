"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startInterviewSession } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function StartInterviewButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const start = () => {
    startTransition(async () => {
      const sessionId = await startInterviewSession();
      router.push(`/interview/${sessionId}`);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mock interview</CardTitle>
        <CardDescription>
          5 problems · 2 hours · weighted by Google frequency with topic diversity
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
