"use client";

import { useEffect, useState } from "react";
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

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [sessions, setSessions] = useState<AssignedSession[]>([]);
  const [sessionTab, setSessionTab] = useState<"upcoming" | "completed">(
    "upcoming",
  );
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    const stored = getStoredUser();
    if (!token || !stored || stored.role !== "HOME_TUTOR") {
      router.replace("/login");
      return;
    }
    setUser(stored);
    setReady(true);

    void (async () => {
      setSessionsLoading(true);
      setSessionsError(null);
      try {
        const { data } = await api.get<AssignedSession[]>("/sessions/mine");
        setSessions(data);
      } catch (error) {
        setSessions([]);
        setSessionsError(
          error instanceof ApiError
            ? error.message
            : "Could not load your sessions.",
        );
      } finally {
        setSessionsLoading(false);
      }
    })();
  }, [router]);

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

  const upcoming = sessions.filter((s) => s.status === "SCHEDULED");
  const completed = sessions.filter((s) => s.status === "COMPLETED");
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
            Open a class journey to leave home, reach the student, start, then
            stop when the class ends.
          </p>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface-muted px-4 py-3">
              <dt className="text-text-secondary">Phone</dt>
              <dd className="mt-1 font-medium text-text">{user.phone}</dd>
            </div>
            <div className="rounded-xl border border-border bg-surface-muted px-4 py-3">
              <dt className="text-text-secondary">Email</dt>
              <dd className="mt-1 break-all font-medium text-text">
                {user.email}
              </dd>
            </div>
          </dl>
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
                ? "No upcoming classes. The CEO will schedule online sessions for you."
                : "No completed classes yet. Sessions move here after you stop the journey."}
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
                  {session.notes ? (
                    <p className="mt-1 text-sm text-text-secondary">
                      Note: {session.notes}
                    </p>
                  ) : null}
                  <Link
                    href={`/sessions/${session.id}/journey`}
                    className="mt-3 inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary-dark"
                  >
                    {session.status === "COMPLETED"
                      ? "View journey"
                      : "Open journey"}
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
