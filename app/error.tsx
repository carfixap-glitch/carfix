"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("CarFix route error", { digest: error.digest ?? null });
  }, [error]);

  return (
    <main className="failure-page">
      <section className="failure-card" role="alert">
        <span className="failure-kicker">TEMPORARY ERROR</span>
        <h1>We couldn&apos;t load this page.</h1>
        <p>
          Your data is safe. Retry the request, or return to the dashboard and
          continue from there.
        </p>
        {error.digest ? <code>Support code: {error.digest}</code> : null}
        <div className="failure-actions">
          <button className="btn primary" type="button" onClick={reset}>
            Try again
          </button>
          <a className="btn" href="/dashboard">
            Go to dashboard
          </a>
        </div>
      </section>
    </main>
  );
}
