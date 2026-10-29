"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { playTts } from "../lib/speech";
import { BackIcon, SpeakerIcon } from "../components/icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <ReviewContent />
    </Suspense>
  );
}

function ReviewContent() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params.get("session");
  const unitName = params.get("unit") || "";

  const [item, setItem] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [ending, setEnding] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  async function loadNext() {
    setLoading(true);
    setRevealed(false);
    const res = await fetch(`${API_URL}/review/next?session_id=${sessionId}`);
    const data = res.ok ? await res.json() : null;
    setItem(data);
    setLoading(false);
    setStarted(true);
  }

  async function answer(rating) {
    if (!item) return;
    await fetch(`${API_URL}/review/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, item_id: item.item_id, rating }),
    });
    setReviewedCount((c) => c + 1);
    loadNext();
  }

  async function endSession() {
    if (!sessionId || ending) return;
    setEnding(true);
    const res = await fetch(`${API_URL}/sessions/${sessionId}/end`, { method: "POST" });
    const summary = await res.json();
    try {
      sessionStorage.setItem("lingua_summary", JSON.stringify(summary));
    } catch {
      // ignore
    }
    router.push("/summary");
  }

  return (
    <div className="page-shell">
      <div className="atmosphere" aria-hidden="true">
        <div className="blob-clay" />
        <div className="blob-moss" />
      </div>

      <div className="page-content" style={{ maxWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 12 }}>
          <button type="button" className="glass icon-btn" aria-label="Back to path" style={{ width: 40, height: 40 }} onClick={() => router.push("/")}>
            <BackIcon />
          </button>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{unitName}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: "0.06em", marginTop: 2 }}>
              REVIEW
            </div>
          </div>
          <button type="button" className="mono" onClick={endSession} disabled={ending} style={{ border: "none", background: "transparent", color: "var(--ink-soft)", fontSize: 10, letterSpacing: "0.05em", cursor: "pointer" }}>
            {ending ? "…" : "END"}
          </button>
        </div>

        <div className="glass" style={{ display: "flex", justifyContent: "center", gap: 10, padding: "14px 24px", borderRadius: 18, marginBottom: 32 }}>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Reviewed this session</span>
          <span className="mono" style={{ fontSize: 14, fontWeight: 500 }}>{reviewedCount}</span>
        </div>

        {!started && !loading && (
          <div style={{ textAlign: "center" }}>
            <button type="button" className="primary-btn" onClick={loadNext}>Start</button>
          </div>
        )}
        {loading && <p style={{ color: "var(--ink-soft)", textAlign: "center" }}>Loading…</p>}
        {started && !loading && !item && (
          <p style={{ color: "var(--ink-soft)", textAlign: "center" }}>Nothing due right now. Come back later.</p>
        )}

        {item && (
          <>
            <div className="glass" style={{ padding: "48px 32px", borderRadius: 28, textAlign: "center", marginBottom: 24 }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--ink-soft)", marginBottom: 24 }}>
                {item.item_type === "vocab" ? "VOCAB" : "SENTENCE"} · {item.is_new ? "NEW" : "DUE"}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
                <span style={{ fontSize: 48, fontWeight: 600 }}>{item.prompt}</span>
                <button type="button" aria-label="Play audio" className="glass icon-btn" style={{ width: 38, height: 38, color: "var(--moss-deep)" }} onClick={() => playTts(params.get("langpack") || "", item.prompt)}>
                  <SpeakerIcon />
                </button>
              </div>

              {!revealed && (
                <button
                  type="button"
                  className="mono"
                  onClick={() => setRevealed(true)}
                  style={{ marginTop: 32, border: "none", background: "transparent", color: "var(--ink-soft)", fontSize: 12, letterSpacing: "0.05em", cursor: "pointer", textDecoration: "underline" }}
                >
                  SHOW ANSWER
                </button>
              )}

              {revealed && (
                <div style={{ marginTop: 28 }}>
                  {item.reading && <div className="mono" style={{ fontSize: 16, color: "var(--ink-soft)" }}>{item.reading}</div>}
                  <div style={{ fontSize: 14, marginTop: 4 }}>{item.meaning}</div>
                </div>
              )}
            </div>

            {revealed && (
              <div className="glass" style={{ display: "flex", borderRadius: 999, overflow: "hidden" }}>
                <button type="button" className="rate-btn" onClick={() => answer("again")} style={{ flex: 1, border: "none", padding: "14px 0", cursor: "pointer", fontWeight: 600, fontSize: 13, background: "rgba(192,106,62,.22)", color: "var(--clay-deep)" }}>Again</button>
                <button type="button" className="rate-btn" onClick={() => answer("hard")} style={{ flex: 1, border: "none", padding: "14px 0", cursor: "pointer", fontWeight: 600, fontSize: 13, background: "rgba(192,106,62,.1)", color: "var(--ink)" }}>Hard</button>
                <button type="button" className="rate-btn" onClick={() => answer("good")} style={{ flex: 1, border: "none", padding: "14px 0", cursor: "pointer", fontWeight: 600, fontSize: 13, background: "rgba(116,128,90,.14)", color: "var(--ink)" }}>Good</button>
                <button type="button" className="rate-btn" onClick={() => answer("easy")} style={{ flex: 1, border: "none", padding: "14px 0", cursor: "pointer", fontWeight: 600, fontSize: 13, background: "rgba(116,128,90,.26)", color: "var(--moss-deep)" }}>Easy</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
