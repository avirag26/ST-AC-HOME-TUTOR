"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ApiError, api } from "@/lib/api";
import { getAccessToken, getStoredUser } from "@/lib/auth-storage";

type ReportPayload = {
  session: {
    id: string;
    title: string | null;
    subjectName: string | null;
    startsAt: string;
    endsAt: string;
    status: string;
    student: {
      fullName: string;
      className: string | null;
      parentName: string;
    } | null;
  };
  report: {
    topicsCovered: string;
    homework: string | null;
    studentNotes: string | null;
    performance: string | null;
    nextPlan: string | null;
    filledAt: string;
    updatedAt: string;
  } | null;
  canEdit: boolean;
};

function formatRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "—";
  return `${start.toLocaleString()} → ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function ClassReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params.id;

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [payload, setPayload] = useState<ReportPayload | null>(null);

  const [topicsCovered, setTopicsCovered] = useState("");
  const [homework, setHomework] = useState("");
  const [studentNotes, setStudentNotes] = useState("");
  const [performance, setPerformance] = useState("");
  const [nextPlan, setNextPlan] = useState("");

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<ReportPayload>(
        `/sessions/${sessionId}/report`,
      );
      setPayload(data);
      setTopicsCovered(data.report?.topicsCovered ?? "");
      setHomework(data.report?.homework ?? "");
      setStudentNotes(data.report?.studentNotes ?? "");
      setPerformance(data.report?.performance ?? "");
      setNextPlan(data.report?.nextPlan ?? "");
    } catch (err) {
      setPayload(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not load class report.",
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

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!payload?.canEdit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data } = await api.put<ReportPayload>(
        `/sessions/${sessionId}/report`,
        {
          topicsCovered,
          homework: homework.trim() || undefined,
          studentNotes: studentNotes.trim() || undefined,
          performance: performance.trim() || undefined,
          nextPlan: nextPlan.trim() || undefined,
        },
      );
      setPayload(data);
      setSuccess("Class report saved. You can download the PDF now.");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not save the report.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    setDownloading(true);
    setError(null);
    try {
      const { data } = await api.get<Blob>(
        `/sessions/${sessionId}/report/pdf`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `class-report-${sessionId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not download PDF. Save the report first.",
      );
    } finally {
      setDownloading(false);
    }
  }

  if (!ready) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-surface-muted px-4">
        <p className="text-sm text-text-secondary">Checking your session…</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-surface-muted">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-sm font-medium text-primary">
              Straight Line Academy
            </p>
            <h1 className="text-lg font-semibold text-text">Class report</h1>
          </div>
          <Link
            href={`/sessions/${sessionId}/journey`}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text hover:bg-surface-muted"
          >
            Back to journey
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        {loading ? (
          <p className="text-sm text-text-secondary">Loading report…</p>
        ) : error && !payload ? (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        ) : payload ? (
          <>
            <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
              <h2 className="text-lg font-semibold text-text">
                {payload.session.title ||
                  payload.session.subjectName ||
                  "Online session"}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {formatRange(payload.session.startsAt, payload.session.endsAt)}
              </p>
              {payload.session.student ? (
                <p className="mt-1 text-sm text-text-secondary">
                  Student: {payload.session.student.fullName}
                  {payload.session.student.className
                    ? ` · ${payload.session.student.className}`
                    : ""}
                </p>
              ) : null}
              {!payload.canEdit ? (
                <p className="mt-3 text-sm text-warning">
                  Stop the class journey first, then fill this report.
                </p>
              ) : null}
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

            <form
              onSubmit={handleSave}
              className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]"
            >
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-text">
                  Topics covered
                </span>
                <textarea
                  required
                  rows={3}
                  value={topicsCovered}
                  disabled={!payload.canEdit}
                  onChange={(e) => setTopicsCovered(e.target.value)}
                  className="min-h-24 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text shadow-sm focus:border-primary disabled:opacity-60"
                  placeholder="What did you teach today?"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-text">
                  Homework (optional)
                </span>
                <textarea
                  rows={2}
                  value={homework}
                  disabled={!payload.canEdit}
                  onChange={(e) => setHomework(e.target.value)}
                  className="min-h-20 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text shadow-sm focus:border-primary disabled:opacity-60"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-text">
                  Student notes (optional)
                </span>
                <textarea
                  rows={2}
                  value={studentNotes}
                  disabled={!payload.canEdit}
                  onChange={(e) => setStudentNotes(e.target.value)}
                  className="min-h-20 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text shadow-sm focus:border-primary disabled:opacity-60"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-text">
                  Performance (optional)
                </span>
                <select
                  value={performance}
                  disabled={!payload.canEdit}
                  onChange={(e) => setPerformance(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text shadow-sm focus:border-primary disabled:opacity-60"
                >
                  <option value="">Select</option>
                  <option value="Excellent">Excellent</option>
                  <option value="Good">Good</option>
                  <option value="Average">Average</option>
                  <option value="Needs help">Needs help</option>
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-text">
                  Next plan (optional)
                </span>
                <textarea
                  rows={2}
                  value={nextPlan}
                  disabled={!payload.canEdit}
                  onChange={(e) => setNextPlan(e.target.value)}
                  className="min-h-20 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text shadow-sm focus:border-primary disabled:opacity-60"
                />
              </label>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="submit"
                  isLoading={saving}
                  disabled={!payload.canEdit}
                  className="sm:flex-1"
                >
                  Save report
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  isLoading={downloading}
                  disabled={!payload.report}
                  onClick={() => void handleDownloadPdf()}
                  className="sm:flex-1"
                >
                  Download PDF
                </Button>
              </div>
            </form>
          </>
        ) : null}
      </div>
    </main>
  );
}
