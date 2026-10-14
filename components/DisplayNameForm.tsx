"use client";

import { useActionState } from "react";
import { saveDisplayName } from "@/app/display-name-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DisplayNameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(saveDisplayName, { error: null, saved: false });

  return <form action={action} className="mt-4 space-y-3">
    <label className="field-label" htmlFor="display-name">Display name</label>
    <Input id="display-name" name="displayName" defaultValue={name}
      required maxLength={40} autoComplete="nickname" />
    <p className="text-xs text-muted">Shown on your dashboard and the leaderboard.</p>
    <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save name"}</Button>
    <p role={state.error ? "alert" : "status"} className="text-xs">
      {state.error ?? (state.saved ? "Display name saved." : "")}
    </p>
  </form>;
}
