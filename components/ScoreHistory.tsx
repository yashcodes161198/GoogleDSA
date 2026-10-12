"use client";

import { useEffect, useId, useRef, useState, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, History, RefreshCw, RotateCcw, Trash2, X } from "lucide-react";
import { deleteScoreActivity } from "@/app/score-actions";
import {
  ACTION_LABELS, ACTIVITY_ACTIONS, activityAction, buildActivityDays,
  formatActivityDate, formatActivityFullDate, formatActivityTime,
  type ActivityFilter, type ActivityPeriod, type ScoreActivity,
} from "@/lib/activity";
import styles from "./ScoreHistory.module.css";

const icons = { solved: Check, "first-revision": RotateCcw, "later-revision": RefreshCw };

export function ScoreHistory({ events, now, error, period = "month", title = "Score history", canDelete = false }: {
  events: ScoreActivity[];
  now: string;
  error: string | null;
  period?: ActivityPeriod;
  title?: string;
  canDelete?: boolean;
}) {
  const historyId = useId();
  const isWeekly = period === "week";
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [visibleDays, setVisibleDays] = useState(7);
  const [refreshing, startRefresh] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteNotice, setDeleteNotice] = useState("");
  const ledgerHeadingRef = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const chart = chartRef.current;
    if (chart) chart.scrollLeft = chart.scrollWidth;
  }, []);
  const days = buildActivityDays(events.filter((event) => !removedIds.includes(event.id)), new Date(now), filter, period);
  const totalPoints = days.reduce((sum, day) => sum + day.points, 0);
  const totalActions = days.reduce((sum, day) => sum + day.events.length, 0);
  const activeDays = days.filter((day) => day.events.length > 0).length;
  const maxPoints = Math.max(1, ...days.map((day) => day.points));
  const filteredDays = [...days].reverse().filter((day) =>
    selectedDay ? day.key === selectedDay : day.events.length > 0);
  const shownDays = filteredDays.slice(0, visibleDays);
  const isEmpty = !shownDays.some((day) => day.events.length > 0);
  const hasFilters = filter !== "all" || selectedDay !== null;

  function clearFilters() {
    setFilter("all");
    setSelectedDay(null);
    setVisibleDays(7);
  }

  function removeAward(event: ScoreActivity) {
    setDeleteError(null);
    setDeleteNotice("");
    startDelete(async () => {
      try {
        const result = await deleteScoreActivity(event.id);
        if (!result.ok) {
          setDeleteError(result.error);
          return;
        }
        setRemovedIds((ids) => [...ids, event.id]);
        setConfirmDelete(null);
        setDeleteNotice(`Deleted ${event.points} points for ${event.problem_title}. Problem progress is unchanged.`);
        ledgerHeadingRef.current?.focus();
        router.refresh();
      } catch {
        setDeleteError("Could not delete this point award. Please try again.");
      }
    });
  }

  return (
    <section className={`surface ${styles.history}`} aria-labelledby={`${historyId}-title`}>
      <div className={styles.heading}>
        <div>
          <h2 id={`${historyId}-title`}>{title}</h2>
          <p>{formatActivityDate(days[0].date)} – {formatActivityDate(isWeekly ? days[6].date : now)} · All times in IST</p>
        </div>
        <span className={styles.period}>{isWeekly ? "This week" : "Last 30 days"}</span>
      </div>

      {error ? (
        <div className={styles.empty} role="alert">
          <History size={26} aria-hidden="true" />
          <h3>History is unavailable</h3>
          <p>{error}</p>
          <button className="button-link secondary" disabled={refreshing}
            onClick={() => startRefresh(() => router.refresh())}>
            <RefreshCw size={15} aria-hidden="true" />{refreshing ? "Retrying…" : "Try again"}
          </button>
        </div>
      ) : (
        <>
          <dl className={styles.totals} aria-label={filter === "all" ? "Period totals" : `${ACTION_LABELS[filter]} totals`}>
            <div><dt>Points earned</dt><dd>{totalPoints}<small> pts</small></dd></div>
            <div><dt>Scoring actions</dt><dd>{totalActions}</dd></div>
            <div><dt>Active days</dt><dd>{activeDays}<small> / {days.length}</small></dd></div>
          </dl>

          <div className={styles.chartSection}>
            <div className={styles.chartCaption}>
              <span>Daily points{filter !== "all" ? ` · ${ACTION_LABELS[filter]}` : ""}</span>
              <span>Select a day to see its activity</span>
            </div>
            <div className={styles.chartScroll} ref={chartRef}>
              <div className={`${styles.chart} ${isWeekly ? styles.weekChart : ""}`}
                aria-label={isWeekly ? "Daily scores for this leaderboard week" : "Daily scores for the past 30 days"}>
                {days.map((day, index) => (
                  <button key={day.key} type="button" className={styles.dayButton}
                    aria-label={`${formatActivityFullDate(day.date)}: ${day.points} points, ${day.events.length} scoring actions`}
                    aria-pressed={selectedDay === day.key}
                    title={`${formatActivityDate(day.date)}: ${day.points} pts`}
                    onClick={() => { setSelectedDay(selectedDay === day.key ? null : day.key); setVisibleDays(7); }}>
                    {isWeekly && <span className={styles.dayPoints} aria-hidden="true">{day.points}</span>}
                    <span className={styles.barTrack}>
                      <span className={styles.bar} data-empty={day.points === 0}
                        style={{ "--bar-height": `${Math.max(4, day.points / maxPoints * 100)}%` } as CSSProperties} />
                    </span>
                    <span className={styles.dayLabel} aria-hidden="true">
                      {isWeekly || index === days.length - 1 || (index % 7 === 0 && index < days.length - 3) ? formatActivityDate(day.date) : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.filters} role="group" aria-label="Filter score history by action">
            {(["all", ...ACTIVITY_ACTIONS] as const).map((value) => (
              <button key={value} type="button" aria-pressed={filter === value}
                onClick={() => { setFilter(value); setVisibleDays(7); }}>
                {value === "all" ? "All actions" : ACTION_LABELS[value]}
              </button>
            ))}
          </div>

          <div className={styles.ledger} aria-live="polite" aria-atomic="false">
            <div className={styles.ledgerHeading}>
              <h3 ref={ledgerHeadingRef} tabIndex={-1}>{selectedDay ? `Activity on ${formatActivityDate(`${selectedDay}T12:00:00Z`)}` : "Daily activity"}</h3>
              {hasFilters && <button type="button" className={styles.clear} onClick={clearFilters}>
                <X size={14} aria-hidden="true" />Clear filters
              </button>}
            </div>
            {canDelete && <p className={styles.deleteHelp}>Misclick? Delete an award to remove its points from history and the leaderboard. Your solved status and revision count stay the same.</p>}
            {deleteError && <p className={styles.deleteFeedback} role="alert">{deleteError}</p>}
            <p className={styles.deleteFeedback} role="status">{deleteNotice}</p>
            {isEmpty ? (
              <div className={styles.empty}>
                <History size={26} aria-hidden="true" />
                <h3>{hasFilters ? "No activity matches these filters" : isWeekly ? "No points recorded this week" : "Your next score starts here"}</h3>
                <p>{hasFilters ? "Try another day or action to find scores." : isWeekly ? "No scoring actions were recorded for this player during this leaderboard week." :
                  "Solve or revise a medium or hard question. Your points and the time you earned them will appear here."}</p>
                {hasFilters ? <button className="button-link secondary" onClick={clearFilters}>Show all activity</button> : !isWeekly &&
                  <Link className="button-link" href="/problems">Browse problems</Link>}
              </div>
            ) : shownDays.map((day) => (
              <section key={day.key} className={styles.dayGroup} aria-labelledby={`${historyId}-day-${day.key}`}>
                <div className={styles.dayHeading}>
                  <h4 id={`${historyId}-day-${day.key}`}>{formatActivityFullDate(day.date)}</h4>
                  <span>{day.events.length} {day.events.length === 1 ? "action" : "actions"}<strong>+{day.points} pts</strong></span>
                </div>
                <ol className={styles.events}>
                  {day.events.map((event) => {
                    const action = activityAction(event);
                    const Icon = icons[action];
                    return (
                      <li key={event.id} className={styles.event}>
                        <time dateTime={event.created_at} className={styles.time}>{formatActivityTime(event.created_at)}</time>
                        <div className={styles.eventBody}>
                          <span className={styles.action}><Icon size={13} aria-hidden="true" />{ACTION_LABELS[action]}</span>
                          <p className={styles.problem}>{event.problem_title}</p>
                          <p className={styles.metadata}>{event.difficulty === "HARD" ? "Hard" : "Medium"}
                            {event.revision_number !== null && ` · Revision ${event.revision_number}`}</p>
                        </div>
                        <div className={styles.eventControls}>
                          <span className={styles.points}>+{event.points}<small> pts</small></span>
                          {canDelete && <button type="button" className={styles.deleteButton}
                            disabled={deleting} aria-expanded={confirmDelete === event.id}
                            aria-controls={confirmDelete === event.id ? `${historyId}-delete-${event.id}` : undefined}
                            aria-label={`Delete ${event.points} points for ${event.problem_title}, ${event.revision_number === null ? "solve" : `revision ${event.revision_number}`}`}
                            onClick={() => { setConfirmDelete(confirmDelete === event.id ? null : event.id); setDeleteError(null); setDeleteNotice(""); }}>
                            <Trash2 size={14} aria-hidden="true" />Delete
                          </button>}
                        </div>
                        {canDelete && confirmDelete === event.id && <div className={styles.deleteConfirmation} id={`${historyId}-delete-${event.id}`}>
                          <p>Delete this {event.points}-point award? This cannot be undone. Problem progress will stay the same.</p>
                          <div>
                            <button type="button" className="button-link secondary" disabled={deleting}
                              onClick={() => { setConfirmDelete(null); setDeleteError(null); }}>Cancel</button>
                            <button type="button" className="button-link" disabled={deleting}
                              onClick={() => removeAward(event)}>{deleting ? "Deleting…" : "Delete award"}</button>
                          </div>
                        </div>}
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
            {filteredDays.length > visibleDays && <button className={`button-link secondary ${styles.more}`}
              onClick={() => setVisibleDays(visibleDays + 7)}>Show earlier activity</button>}
          </div>
          <p className={styles.footnote}>These are the same points used for the weekly leaderboard. Each award is recorded once.</p>
        </>
      )}
    </section>
  );
}
