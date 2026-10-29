"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SummaryPage() {
  const router = useRouter();
  const [summary, setSummary] = useState(undefined);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("lingua_summary");
      setSummary(raw ? JSON.parse(raw) : null);
    } catch {
      setSummary(null);
    }
  }, []);

  return (
    <div className="page-shell">
      <div className="atmosphere" aria-hidden="true">
        <div
          style={{
            position: "absolute", width: 620, height: 620, left: "50%", top: -220,
            transform: "translateX(-50%)", background: "var(--clay)", opacity: 0.3, filter: "blur(120px)", borderRadius: "50%",
          }}
        />
        <div className="blob-moss" />
      </div>

      <div className="page-content" style={{ maxWidth: 560, paddingTop: 48 }}>
        {summary === undefined && <p style={{ color: "var(--ink-soft)", textAlign: "center" }}>Loading…</p>}

        {summary === null && (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "var(--ink-soft)" }}>No session summary to show - this page is reached from ending a chat or review session.</p>
            <button type="button" className="primary-btn" onClick={() => router.push("/")}>Back to path</button>
          </div>
        )}

        {summary && (
          <>
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <div className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--ink-soft)" }}>
                {summary.unit_name.toUpperCase()} · SESSION COMPLETE
              </div>
            </div>

            <div style={{ textAlign: "center", margin: "24px 0 36px" }}>
              <div className="mono" style={{ fontSize: 88, fontWeight: 700, lineHeight: 1, color: "var(--clay-deep)" }}>
                {Math.round(summary.score * 100)}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>Confidence score</div>
            </div>

            <div className="glass" style={{ padding: "24px 28px", borderRadius: 22, marginBottom: 24 }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{summary.feedback}</p>
            </div>

            <div className="glass" style={{ display: "flex", padding: "18px 10px", borderRadius: 18, marginBottom: 28 }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div className="mono" style={{ fontSize: 20, fontWeight: 500 }}>{summary.words_practiced.length}</div>
                <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 2 }}>Words practiced</div>
              </div>
              <div style={{ width: 1, background: "rgba(42,36,32,.12)" }} aria-hidden="true" />
              <div style={{ flex: 1, textAlign: "center" }}>
                <div className="mono" style={{ fontSize: 20, fontWeight: 500 }}>{summary.new_words}</div>
                <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 2 }}>New words</div>
              </div>
              <div style={{ width: 1, background: "rgba(42,36,32,.12)" }} aria-hidden="true" />
              <div style={{ flex: 1, textAlign: "center" }}>
                <div className="mono" style={{ fontSize: 20, fontWeight: 500 }}>{Math.round(summary.duration_seconds / 60)}m</div>
                <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 2 }}>Time spent</div>
              </div>
            </div>

            {summary.words_practiced.length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--ink-soft)", marginBottom: 10 }}>
                  WORDS FROM TODAY
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {summary.words_practiced.map((w, i) => (
                    <span key={i} className="mono glass" style={{ padding: "6px 12px", borderRadius: 999, fontSize: 13 }}>{w}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ textAlign: "center" }}>
              <button type="button" className="primary-btn" onClick={() => router.push("/")}>Continue journey</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
