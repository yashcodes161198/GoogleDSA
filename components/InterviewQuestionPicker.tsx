"use client";

import { useId, useMemo, useRef, useState } from "react";
import { X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DifficultyBadge } from "@/components/ui/badge";
import type { Difficulty } from "@/lib/types";

export type InterviewQuestionOption = {
  id: string;
  title: string;
  difficulty: Difficulty;
};

export function InterviewQuestionPicker({
  problems,
  selectedIds,
  onChange,
}: {
  problems: InterviewQuestionOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const listId = useId();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const options = useMemo(
    () =>
      problems
        .filter(
          (p) =>
            !selectedIds.includes(p.id) &&
            p.title.toLowerCase().includes(query.trim().toLowerCase()),
        )
        .sort((a, b) => a.title.localeCompare(b.title)),
    [problems, selectedIds, query],
  );
  const results = options.slice(0, 12);
  const byId = new Map(problems.map((p) => [p.id, p]));
  const add = (id: string) => {
    onChange([...selectedIds, id]);
    setQuery("");
    setActive(0);
    setOpen(false);
    input.current?.focus();
  };
  return (
    <div className="space-y-3">
      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setOpen(false);
        }}
      >
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
          Find a question
        </label>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-3 text-muted"
            aria-hidden="true"
          />
          <Input
            ref={input}
            id={inputId}
            className="pl-9"
            placeholder="Search by question name..."
            autoComplete="off"
            value={query}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-describedby={`${listId}-hint`}
            aria-activedescendant={
              open && results[active]
                ? `${listId}-${results[active].id}`
                : undefined
            }
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
              }
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setOpen(true);
                const next = Math.max(
                  0,
                  Math.min(
                    results.length - 1,
                    active + (event.key === "ArrowDown" ? 1 : -1),
                  ),
                );
                setActive(next);
                document
                  .getElementById(`${listId}-${results[next]?.id}`)
                  ?.scrollIntoView({ block: "nearest" });
              }
              if (event.key === "Enter") {
                event.preventDefault();
                if (open && results[active]) add(results[active].id);
                else setOpen(true);
              }
            }}
          />
        </div>
        {open && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
            <ul
              id={listId}
              role="listbox"
              aria-label="Matching questions"
              className="max-h-64 overflow-y-auto p-1"
            >
              {results.map((p, index) => (
                <li
                  key={p.id}
                  id={`${listId}-${p.id}`}
                  role="option"
                  aria-selected={active === index}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm ${active === index ? "bg-subtle" : ""}`}
                  onPointerMove={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => add(p.id)}
                >
                  <span>{p.title}</span>
                  <DifficultyBadge difficulty={p.difficulty} />
                </li>
              ))}
              {!results.length && (
                <li className="px-3 py-4 text-sm text-muted">
                  {query.trim()
                    ? "No matching questions. Try another name."
                    : "All available questions are selected."}
                </li>
              )}
            </ul>
            {options.length > results.length && (
              <p className="border-t border-line px-3 py-2 text-xs text-muted">
                Showing 12 of {options.length}. Keep typing to narrow the list.
              </p>
            )}
          </div>
        )}
      </div>
      <p id={`${listId}-hint`} className="text-xs text-muted">
        Search and select questions. They will appear in the order you add them.
      </p>
      <p className="text-sm font-medium" role="status">
        {selectedIds.length} question{selectedIds.length === 1 ? "" : "s"}{" "}
        selected
      </p>
      {selectedIds.length ? (
        <ol className="max-h-72 overflow-y-auto divide-y divide-line rounded-lg border border-line">
          {selectedIds.map((id, index) => {
            const p = byId.get(id);
            if (!p) return null;
            return (
              <li
                key={id}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <input type="hidden" name="problemIds" value={id} />
                <span className="w-5 shrink-0 text-xs tabular-nums text-muted">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">{p.title}</span>
                <DifficultyBadge difficulty={p.difficulty} />
                <button
                  type="button"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-foreground sm:h-9 sm:w-9"
                  aria-label={`Remove ${p.title}`}
                  onClick={() =>
                    onChange(selectedIds.filter((selected) => selected !== id))
                  }
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">
          Add your first question using the search above.
        </p>
      )}
    </div>
  );
}
