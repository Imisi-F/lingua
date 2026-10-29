"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { BackIcon } from "../components/icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryContent />
    </Suspense>
  );
}

function HistoryContent() {
  const params = useSearchParams();
  const router = useRouter();

  const [langpacks, setLangpacks] = useState([]);
  const [filter, setFilter] = useState(params.get("langpack") || "all");
  const [sessions, setSessions] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/langpacks`).then((res) => res.json()).then(setLangpacks).catch(() => setLangpacks([]));
  }, []);

  useEffect(() => {
    setSessions(null);
    const query = filter === "all" ? "" : `?langpack=${filter}`;
    fetch(`${API_URL}/sessions${query}`)
      .then((res) => res.json())
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [filter]);

  return (
    <div className="page-shell">
      <div className="atmosphere" aria-hidden="true">
        <div className="blob-clay" />
        <div className="blob-moss" />
      </div>

      <div className="page-content">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <button type="button" className="glass icon-btn" aria-label="Back to path" style={{ width: 40, height: 40 }} onClick={() => router.push("/")}>
            <BackIcon />
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Conversation history</h1>
        </div>

        <div className="glass" style={{ display: "inline-flex", padding: 4, borderRadius: 999, marginBottom: 24 }}>
          <button type="button" className={`toggle-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All</button>
          {langpacks.map((lp) => (
            <button key={lp.code} type="button" className={`toggle-btn ${filter === lp.code ? "active" : ""}`} onClick={() => setFilter(lp.code)}>
              {lp.name}
            </button>
          ))}
        </div>

        {sessions === null && <p style={{ color: "var(--ink-soft)" }}>Loading…</p>}
        {sessions && sessions.length === 0 && <p style={{ color: "var(--ink-soft)" }}>No finished sessions yet.</p>}

        {sessions && sessions.map((s) => (
          <div key={s.id} className="glass" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 18px", borderRadius: 16, marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{s.unit_name}</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--ink-soft)" }}>
                  {s.langpack.toUpperCase()} · {s.activity.toUpperCase()} · {new Date(s.started_at).toLocaleDateString()}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.snippet}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div className="mono" style={{ fontSize: 16, fontWeight: 500, color: "var(--clay-deep)" }}>
                {s.score != null ? `${Math.round(s.score * 100)}%` : "—"}
              </div>
              <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>{Math.round(s.duration_seconds / 60)} min</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
