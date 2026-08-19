"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { startNewInterviewAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function StartButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Starting..." : "Start new interview"}
    </Button>
  );
}

export function StartInterviewButton({
  hasActiveSession = false,
}: {
  hasActiveSession?: boolean;
}) {
  const [state, formAction] = useActionState(startNewInterviewAction, null);

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
        <form action={formAction} className="space-y-3">
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <StartButton />
        </form>
      </CardContent>
    </Card>
  );
}
