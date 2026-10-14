"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { saveDisplayName } from "@/app/display-name-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DisplayNameForm({ name }: { name: string }) {
  const [editing, setEditing] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const editButton = useRef<HTMLButtonElement>(null);
  const displayName = savedName ?? name;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const result = await saveDisplayName(formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        setSavedName(result.name);
        setError(null);
        setStatus("Display name saved.");
        setEditing(false);
        requestAnimationFrame(() => editButton.current?.focus());
      } catch {
        setError("Your name could not be saved. Try again.");
      }
    });
  }

  return <>
    {editing ? <form onSubmit={handleSubmit} className="space-y-3">
      <label className="sr-only" htmlFor="display-name">Display name</label>
      <Input id="display-name" name="displayName" defaultValue={displayName}
        required maxLength={40} autoComplete="nickname" autoFocus disabled={pending} />
      {error && <p role="alert" className="text-xs">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending}
          onClick={() => {
            setEditing(false);
            requestAnimationFrame(() => editButton.current?.focus());
          }}>Cancel</Button>
      </div>
    </form> : <div className="flex min-w-0 items-center justify-between gap-2">
      <span className="min-w-0 break-words font-medium">{displayName}</span>
      <button ref={editButton} type="button" className="min-h-9 shrink-0 rounded px-2 text-xs font-medium text-[var(--accent-text)] hover:underline"
        aria-label="Edit display name" onClick={() => {
          setError(null);
          setStatus("");
          setEditing(true);
        }}>Edit</button>
    </div>}
    <span role="status" className="sr-only">{status}</span>
  </>;
}
