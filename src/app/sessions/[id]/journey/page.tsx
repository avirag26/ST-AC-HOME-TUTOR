"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ApiError, api } from "@/lib/api";
import { getAccessToken, getStoredUser } from "@/lib/auth-storage";

type JourneyStep =
  | "NOT_STARTED"
  | "LEFT_HOME"
  | "REACHED"
  | "CLASS_STARTED"
  | "STOPPED";

type NextAction = "LEAVE_HOME" | "REACH" | "START_CLASS" | "STOP" | null;

type JourneyResponse = {
  session: {
    id: string;
    title: string | null;
    subjectName: string | null;
    startsAt: string;
    endsAt: string;
    status: string;
    notes: string | null;
    student: {
      id: string;
      fullName: string;
      className: string | null;
      parentName: string;
    } | null;
  };
  journey: {
    step: JourneyStep;
    leftHomeAt: string | null;
    reachedAt: string | null;
    classStartedAt: string | null;
    stoppedAt: string | null;
    nextAction: NextAction;
  };
};

const STEPS: { id: JourneyStep; label: string; doneKey: keyof JourneyResponse["journey"] }[] = [
  { id: "LEFT_HOME", label: "Leave home", doneKey: "leftHomeAt" },
  { id: "REACHED", label: "Reach student", doneKey: "reachedAt" },
  { id: "CLASS_STARTED", label: "Start class", doneKey: "classStartedAt" },
  { id: "STOPPED", label: "Stop class", doneKey: "stoppedAt" },
];

const ACTION_META: Record<
  Exclude<NextAction, null>,
  { path: string; label: string; help: string }
> = {
  LEAVE_HOME: {
    path: "leave",
    label: "Leave home",
    help: "Tap when you leave for the student’s home.",
  },
  REACH: {
    path: "reach",
    label: "I’ve reached",
    help: "Tap when you arrive at the student’s location.",
  },
  START_CLASS: {
    path: "start",
    label: "Start class",
    help: "Tap when the class begins.",
  },
  STOP: {
    path: "stop",
    label: "Stop class",
    help: "Tap when the class ends. Session moves to Completed.",
  },
};

function formatRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "—";
  return `${start.toLocaleString()} → ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function formatWhen(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

function readLocation(): Promise<{ lat?: number; lng?: number }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({});
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

export default function JourneyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params.id;

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [data, setData] = useState<JourneyResponse | null>(null);
  const [liveSharing, setLiveSharing] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get<JourneyResponse>(
        `/sessions/${sessionId}/journey`,
      );
      setData(res);
    } catch (err) {
      setData(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not load this class journey.",
      );
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    const token = getAccessToken();
    const stored = getStoredUser();
    if (!token || !stored || stored.role !== "HOME_TUTOR") {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    if (!ready || !sessionId || !data) {
      setLiveSharing(false);
      return;
    }

    const step = data.journey.step;
    const active =
      step === "LEFT_HOME" || step === "REACHED" || step === "CLASS_STARTED";
    if (!active) {
      setLiveSharing(false);
      return;
    }

    let cancelled = false;
    setLiveSharing(true);

    async function pingOnce() {
      const location = await readLocation();
      if (
        cancelled ||
        typeof location.lat !== "number" ||
        typeof location.lng !== "number"
      ) {
        return;
      }
      try {
        await api.post(`/sessions/${sessionId}/journey/ping`, {
          lat: location.lat,
          lng: location.lng,
        });
      } catch {
        // Keep journey usable if Redis/ping fails.
      }
    }

    void pingOnce();
    const timer = window.setInterval(() => {
      void pingOnce();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      setLiveSharing(false);
    };
  }, [ready, sessionId, data?.journey.step]);

  async function handleNext() {
    if (!data?.journey.nextAction) return;
    const action = data.journey.nextAction;
    const meta = ACTION_META[action];
    setActing(true);
    setError(null);
    setSuccess(null);
    try {
      const location = await readLocation();
      const { data: res } = await api.post<JourneyResponse>(
        `/sessions/${sessionId}/journey/${meta.path}`,
        location,
      );
      setData(res);
      setSuccess(
        action === "STOP"
          ? "Class stopped. Session is Completed."
          : `${meta.label} recorded.`,
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not update journey. Try again.",
      );
    } finally {
      setActing(false);
    }
  }

  if (!ready) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-surface-muted px-4">
        <p className="text-sm text-text-secondary">Checking your session…</p>
      </main>
    );
  }

  const next = data?.journey.nextAction ?? null;
  const nextMeta = next ? ACTION_META[next] : null;

  return (
    <main className="min-h-dvh bg-surface-muted">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-sm font-medium text-primary">
              Straight Line Academy
            </p>
            <h1 className="text-lg font-semibold text-text">Class journey</h1>
          </div>
          <Link
            href="/dashboard"
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text hover:bg-surface-muted"
          >
            Back
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        {loading ? (
          <p className="text-sm text-text-secondary">Loading journey…</p>
        ) : error && !data ? (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        ) : data ? (
          <>
            <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
              <h2 className="text-lg font-semibold text-text">
                {data.session.title ||
                  data.session.subjectName ||
                  "Online session"}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {formatRange(data.session.startsAt, data.session.endsAt)}
              </p>
              {data.session.student ? (
                <p className="mt-1 text-sm text-text-secondary">
                  Student: {data.session.student.fullName}
                  {data.session.student.className
                    ? ` · ${data.session.student.className}`
                    : ""}
                  {" · "}Parent: {data.session.student.parentName}
                </p>
              ) : null}
              <p className="mt-3 text-sm text-text-secondary">
                Status:{" "}
                <span className="font-medium text-text">
                  {data.session.status}
                </span>
              </p>
              {liveSharing ? (
                <p className="mt-2 text-sm font-medium text-primary">
                  Sharing live location with CEO (every 15s while journey is
                  active).
                </p>
              ) : null}
            </section>

            <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
              <h3 className="text-base font-semibold text-text">Progress</h3>
              <ol className="mt-4 space-y-3">
                {STEPS.map((step, index) => {
                  const doneAt = data.journey[step.doneKey] as string | null;
                  const done = Boolean(doneAt);
                  const isCurrent =
                    nextMeta &&
                    ((next === "LEAVE_HOME" && step.id === "LEFT_HOME") ||
                      (next === "REACH" && step.id === "REACHED") ||
                      (next === "START_CLASS" && step.id === "CLASS_STARTED") ||
                      (next === "STOP" && step.id === "STOPPED"));

                  return (
                    <li
                      key={step.id}
                      className={[
                        "rounded-xl border px-4 py-3",
                        done
                          ? "border-success/40 bg-emerald-50"
                          : isCurrent
                            ? "border-primary bg-primary/5"
                            : "border-border bg-surface-muted",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-text">
                            {index + 1}. {step.label}
                          </p>
                          <p className="mt-0.5 text-xs text-text-secondary">
                            {done
                              ? formatWhen(doneAt)
                              : isCurrent
                                ? "Next step"
                                : "Waiting"}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-text-secondary">
                          {done ? "Done" : isCurrent ? "Now" : "—"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            {error ? (
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="text-sm text-success" role="status">
                {success}
              </p>
            ) : null}

            {nextMeta ? (
              <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
                <p className="text-sm text-text-secondary">{nextMeta.help}</p>
                <p className="mt-2 text-xs text-text-secondary">
                  Location is captured if you allow it in the browser. You can
                  continue even if location is denied.
                </p>
                <Button
                  fullWidth
                  className="mt-4"
                  isLoading={acting}
                  onClick={() => void handleNext()}
                >
                  {nextMeta.label}
                </Button>
              </section>
            ) : (
              <section className="rounded-2xl border border-success/30 bg-emerald-50 p-5">
                <p className="font-semibold text-success">Journey complete</p>
                <p className="mt-1 text-sm text-text-secondary">
                  This class is stopped and marked Completed. Class report /
                  PDF comes in a later step.
                </p>
                <Link
                  href="/dashboard"
                  className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark"
                >
                  Back to dashboard
                </Link>
              </section>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
