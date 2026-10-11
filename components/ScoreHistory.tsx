"use client";

import { useEffect, useId, useRef, useState, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, History, RefreshCw, RotateCcw, X } from "lucide-react";
import {
  ACTION_LABELS, ACTIVITY_ACTIONS, activityAction, buildActivityDays,
  formatActivityDate, formatActivityFullDate, formatActivityTime,
  type ActivityFilter, type ActivityPeriod, type ScoreActivity,
} from "@/lib/activity";
import styles from "./ScoreHistory.module.css";

const icons = { solved: Check, "first-revision": RotateCcw, "later-revision": RefreshCw };

export function ScoreHistory({ events, now, error, period = "month", title = "Score history" }: {
  events: ScoreActivity[];
  now: string;
  error: string | null;
  period?: ActivityPeriod;
  title?: string;
}) {
  const historyId = useId();
  const isWeekly = period === "week";
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [visibleDays, setVisibleDays] = useState(7);
  const [refreshing, startRefresh] = useTransition();
  const router = useRouter();
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const chart = chartRef.current;
    if (chart) chart.scrollLeft = chart.scrollWidth;
  }, []);
  const days = buildActivityDays(events, new Date(now), filter, period);
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
              <h3>{selectedDay ? `Activity on ${formatActivityDate(`${selectedDay}T12:00:00Z`)}` : "Daily activity"}</h3>
              {hasFilters && <button type="button" className={styles.clear} onClick={clearFilters}>
                <X size={14} aria-hidden="true" />Clear filters
              </button>}
            </div>
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
                        <span className={styles.points}>+{event.points}<small> pts</small></span>
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
