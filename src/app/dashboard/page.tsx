"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ApiError, api } from "@/lib/api";
import {
  clearSession,
  getAccessToken,
  getStoredUser,
  type AuthUser,
} from "@/lib/auth-storage";

type JourneySummary = {
  step: string;
  leftHomeAt: string | null;
  reachedAt: string | null;
  classStartedAt: string | null;
  stoppedAt: string | null;
};

type SessionHours = {
  travelMinutes: number | null;
  classMinutes: number | null;
  totalMinutes: number | null;
};

type AssignedSession = {
  id: string;
  title: string | null;
  mode: string;
  status: string;
  subjectName: string | null;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  student: {
    id: string;
    fullName: string;
    className: string | null;
    parentName: string;
  } | null;
  journey: JourneySummary | null;
  hours?: SessionHours;
};

type HoursSummary = {
  from: string | null;
  to: string | null;
  completedSessions: number;
  sessionsWithClassHours: number;
  totals: {
    classMinutes: number;
    travelMinutes: number;
    totalMinutes: number;
    classHours: number;
    travelHours: number;
    totalHours: number;
  };
};

function formatRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "—";
  return `${start.toLocaleString()} → ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function journeyLabel(step: string | undefined) {
  switch (step) {
    case "LEFT_HOME":
      return "Left home";
    case "REACHED":
      return "Reached";
    case "CLASS_STARTED":
      return "Class started";
    case "STOPPED":
      return "Stopped";
    default:
      return "Not started";
  }
}

function formatDuration(minutes: number | null | undefined) {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function startOfMonthInput() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${month}-01`;
}

function todayInput() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [sessions, setSessions] = useState<AssignedSession[]>([]);
  const [hours, setHours] = useState<HoursSummary | null>(null);
  const [sessionTab, setSessionTab] = useState<"upcoming" | "completed">(
    "upcoming",
  );
  const [fromDate, setFromDate] = useState(startOfMonthInput);
  const [toDate, setToDate] = useState(todayInput);
  const [studentId, setStudentId] = useState("");
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const params: Record<string, string> = {};
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

      const [sessionsRes, hoursRes] = await Promise.all([
        api.get<AssignedSession[]>("/sessions/mine", { params }),
        api.get<HoursSummary>("/sessions/mine/hours", { params }),
      ]);
      setSessions(sessionsRes.data);
      setHours(hoursRes.data);
    } catch (error) {
      setSessions([]);
      setHours(null);
      setSessionsError(
        error instanceof ApiError
          ? error.message
          : "Could not load your sessions.",
      );
    } finally {
      setSessionsLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    const token = getAccessToken();
    const stored = getStoredUser();
    if (!token || !stored || stored.role !== "HOME_TUTOR") {
      router.replace("/login");
      return;
    }
    setUser(stored);
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  const studentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const session of sessions) {
      if (session.student) {
        map.set(
          session.student.id,
          `${session.student.fullName}${
            session.student.className ? ` · ${session.student.className}` : ""
          }`,
        );
      }
    }
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [sessions]);

  const displayHours = useMemo(() => {
    const source = studentId
      ? sessions.filter(
          (s) => s.status === "COMPLETED" && s.student?.id === studentId,
        )
      : sessions.filter((s) => s.status === "COMPLETED");

    let classMinutes = 0;
    let travelMinutes = 0;
    for (const session of source) {
      if (session.hours?.classMinutes != null) {
        classMinutes += session.hours.classMinutes;
      }
      if (session.hours?.travelMinutes != null) {
        travelMinutes += session.hours.travelMinutes;
      }
    }

    if (!studentId && hours) {
      return {
        completedSessions: hours.completedSessions,
        classMinutes: hours.totals.classMinutes,
        travelMinutes: hours.totals.travelMinutes,
      };
    }

    return {
      completedSessions: source.length,
      classMinutes,
      travelMinutes,
    };
  }, [hours, studentId, sessions]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await api.post("/auth/logout");
    } catch {
      // clear anyway
    } finally {
      clearSession();
      router.replace("/login");
    }
  }

  if (!ready || !user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-surface-muted px-4">
        <p className="text-sm text-text-secondary">Checking your session…</p>
      </main>
    );
  }

  const filteredSessions = studentId
    ? sessions.filter((s) => s.student?.id === studentId)
    : sessions;
  const upcoming = filteredSessions.filter((s) => s.status === "SCHEDULED");
  const completed = filteredSessions.filter((s) => s.status === "COMPLETED");
  const visible = sessionTab === "upcoming" ? upcoming : completed;

  return (
    <main className="min-h-dvh bg-surface-muted">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-sm font-medium text-primary">
              Straight Line Academy
            </p>
            <h1 className="text-lg font-semibold text-text">Home Tutor</h1>
          </div>
          <Button
            variant="secondary"
            onClick={handleSignOut}
            isLoading={signingOut}
          >
            Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-8">
          <h2 className="text-xl font-semibold text-text">
            Welcome, {user.fullName}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            Track journeys, fill reports, and review class hours for a date
            range.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-8">
          <h3 className="text-base font-semibold text-text">Hours & filters</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-text">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text shadow-sm focus:border-primary"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-text">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text shadow-sm focus:border-primary"
              />
            </label>
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-text">Student</span>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text shadow-sm focus:border-primary"
              >
                <option value="">All students</option>
                {studentOptions.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface-muted px-4 py-3">
              <p className="text-xs text-text-secondary">Class hours</p>
              <p className="mt-1 text-lg font-semibold text-text">
                {formatDuration(displayHours.classMinutes)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface-muted px-4 py-3">
              <p className="text-xs text-text-secondary">Travel time</p>
              <p className="mt-1 text-lg font-semibold text-text">
                {formatDuration(displayHours.travelMinutes)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface-muted px-4 py-3">
              <p className="text-xs text-text-secondary">Completed classes</p>
              <p className="mt-1 text-lg font-semibold text-text">
                {displayHours.completedSessions}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-text-secondary">
            Class hours = start → stop. Travel = leave home → reach. Based on
            completed journeys in this date range.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-8">
          <h3 className="text-base font-semibold text-text">My sessions</h3>
          <div
            className="mt-4 grid grid-cols-2 gap-2"
            role="tablist"
            aria-label="Session status"
          >
            {(
              [
                {
                  id: "upcoming" as const,
                  label: `Upcoming (${upcoming.length})`,
                },
                {
                  id: "completed" as const,
                  label: `Completed (${completed.length})`,
                },
              ] as const
            ).map((tab) => {
              const selected = sessionTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setSessionTab(tab.id)}
                  className={[
                    "min-h-11 rounded-xl border px-3 text-sm font-semibold",
                    selected
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-surface text-text hover:bg-surface-muted",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {sessionsLoading ? (
            <p className="mt-3 text-sm text-text-secondary">Loading…</p>
          ) : sessionsError ? (
            <p className="mt-3 text-sm text-error" role="alert">
              {sessionsError}
            </p>
          ) : visible.length === 0 ? (
            <p className="mt-3 text-sm text-text-secondary">
              {sessionTab === "upcoming"
                ? "No upcoming classes in this filter. Try widening the dates."
                : "No completed classes in this filter yet."}
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {visible.map((session) => (
                <article
                  key={session.id}
                  className="rounded-xl border border-border bg-surface-muted px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-text">
                      {session.title ||
                        session.subjectName ||
                        "Online session"}
                    </p>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        session.status === "COMPLETED"
                          ? "bg-surface text-text-secondary"
                          : "bg-emerald-50 text-success",
                      ].join(" ")}
                    >
                      {session.status}
                    </span>
                    {session.status === "SCHEDULED" ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {journeyLabel(session.journey?.step)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    {formatRange(session.startsAt, session.endsAt)}
                  </p>
                  {session.student ? (
                    <p className="mt-1 text-sm text-text-secondary">
                      Student: {session.student.fullName}
                      {session.student.className
                        ? ` · ${session.student.className}`
                        : ""}
                      {" · "}Parent: {session.student.parentName}
                    </p>
                  ) : null}
                  {session.status === "COMPLETED" && session.hours ? (
                    <p className="mt-1 text-sm text-text-secondary">
                      Class {formatDuration(session.hours.classMinutes)}
                      {" · "}Travel{" "}
                      {formatDuration(session.hours.travelMinutes)}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/sessions/${session.id}/journey`}
                      className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary-dark"
                    >
                      {session.status === "COMPLETED"
                        ? "View journey"
                        : "Open journey"}
                    </Link>
                    {session.status === "COMPLETED" ? (
                      <Link
                        href={`/sessions/${session.id}/report`}
                        className="inline-flex min-h-10 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-text hover:bg-surface-muted"
                      >
                        Class report
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
