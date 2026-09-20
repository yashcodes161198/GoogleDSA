"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addQuestionAction, type AddQuestionActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { NewProblemFormValues } from "@/lib/problems/parseNewProblemInput";
import type { Difficulty } from "@/lib/types";

const emptyValues: NewProblemFormValues = {
  title: "",
  difficulty: "MEDIUM",
  leetcodeUrl: "",
  gfgUrl: "",
  tufUrl: "",
  topics: "",
  frequency: "",
  acceptanceRate: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Add question"}
    </Button>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-sm text-red-600" role="alert">
      {message}
    </p>
  );
}

const selectClassName =
  "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950";

export function AddQuestionForm() {
  const [state, formAction] = useActionState<AddQuestionActionState, FormData>(
    addQuestionAction,
    null
  );
  const values = state?.values ?? emptyValues;
  const fieldErrors = state?.fieldErrors;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Question details</CardTitle>
        <CardDescription>
          Adds a shared question to the catalog for every signed-in user. Include
          at least one practice link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          key={state ? JSON.stringify(values) : "initial"}
          action={formAction}
          className="space-y-6"
        >
          <div className="space-y-4">
            <label className="block space-y-1.5 text-sm font-medium">
              Title <span className="text-red-600">*</span>
              <Input
                name="title"
                defaultValue={values.title}
                placeholder="e.g. Merge k Sorted Lists"
                required
                aria-invalid={Boolean(fieldErrors?.title)}
              />
              <FieldError message={fieldErrors?.title} />
            </label>

            <label className="block space-y-1.5 text-sm font-medium">
              Difficulty <span className="text-red-600">*</span>
              <select
                name="difficulty"
                className={selectClassName}
                defaultValue={values.difficulty}
                required
              >
                {(["MEDIUM", "HARD"] as Difficulty[]).map((d) => (
                  <option key={d} value={d}>
                    {d.charAt(0) + d.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
              <FieldError message={fieldErrors?.difficulty} />
            </label>
          </div>

          <fieldset className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <legend className="px-1 text-sm font-medium">Practice links</legend>
            <p className="text-xs text-zinc-500">
              LeetCode is preferred when multiple links are provided.
            </p>
            <label className="block space-y-1.5 text-sm font-medium">
              LeetCode URL
              <Input
                name="leetcodeUrl"
                type="url"
                inputMode="url"
                defaultValue={values.leetcodeUrl}
                placeholder="https://leetcode.com/problems/..."
              />
              <FieldError message={fieldErrors?.leetcodeUrl} />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              GeeksforGeeks URL
              <Input
                name="gfgUrl"
                type="url"
                inputMode="url"
                defaultValue={values.gfgUrl}
                placeholder="https://www.geeksforgeeks.org/problems/..."
              />
              <FieldError message={fieldErrors?.gfgUrl} />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              TakeUForward URL
              <Input
                name="tufUrl"
                type="url"
                inputMode="url"
                defaultValue={values.tufUrl}
                placeholder="https://takeuforward.org/plus/dsa/problems/..."
              />
              <FieldError message={fieldErrors?.tufUrl} />
            </label>
          </fieldset>

          <label className="block space-y-1.5 text-sm font-medium">
            Topics
            <Input
              name="topics"
              defaultValue={values.topics}
              placeholder="Array, Heap, Divide and Conquer"
            />
            <span className="text-xs font-normal text-zinc-500">
              Comma-separated
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm font-medium">
              Frequency (%)
              <Input
                name="frequency"
                type="number"
                min={0}
                max={100}
                step="0.1"
                defaultValue={values.frequency}
                placeholder="0"
              />
              <FieldError message={fieldErrors?.frequency} />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              Acceptance rate (%)
              <Input
                name="acceptanceRate"
                type="number"
                min={0}
                max={100}
                step="0.1"
                defaultValue={values.acceptanceRate}
                placeholder="0"
              />
              <FieldError message={fieldErrors?.acceptanceRate} />
            </label>
          </div>

          {state?.error && (
            <p className="text-sm text-red-600" role="alert">
              {state.error}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <SubmitButton />
            <Link
              href="/problems"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Cancel
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
