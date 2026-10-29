"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { LangpackProvider, useLangpack } from "./LangpackContext";
import LangpackSwitcher from "./components/LangpackSwitcher";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const UNLOCK_THRESHOLD = 0.7;
const WINDOW_BEFORE = 2;
const WINDOW_SIZE = 15;
const JUSTIFY_CYCLE = ["flex-start", "flex-end", "flex-start", "flex-end"];

export default function PathPage() {
  return (
    <LangpackProvider>
      <PathContent />
    </LangpackProvider>
  );
}

function PathContent() {
  const { langpack } = useLangpack() || {};
  const router = useRouter();
  const [units, setUnits] = useState(null);
  const [starting, setStarting] = useState(null);
  const currentRef = useRef(null);

  useEffect(() => {
    if (!langpack) return;
    setUnits(null);
    fetch(`${API_URL}/units?langpack=${langpack}`)
      .then((res) => res.json())
      .then(setUnits)
      .catch(() => setUnits([]));
  }, [langpack]);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center" });
  }, [units]);

  async function startSession(unit, activity) {
    setStarting(`${unit.id}:${activity}`);
    const res = await fetch(`${API_URL}/sessions/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ langpack, unit_id: unit.id, activity }),
    });
    const data = await res.json();
    const dest = activity === "chat" ? "/chat" : "/review";
    router.push(`${dest}?session=${data.session_id}&unit=${encodeURIComponent(unit.name)}&langpack=${langpack}`);
  }

  const wordsUnlocked = units ? units.filter((u) => u.unlocked).reduce((sum, u) => sum + u.word_count, 0) : 0;
  const currentIndex = units
    ? (() => {
        const idx = units.findIndex((u) => u.unlocked && u.score < UNLOCK_THRESHOLD);
        return idx === -1 ? Math.max(0, units.length - 1) : idx;
      })()
    : 0;

  const windowStart = Math.max(0, currentIndex - WINDOW_BEFORE);
  const visible = units ? units.slice(windowStart, windowStart + WINDOW_SIZE) : [];

  return (
    <div className="page-shell">
      <div className="atmosphere" aria-hidden="true">
        <div className="blob-clay" />
        <div className="blob-moss" />
      </div>

      <div className="page-content">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <span className="mono" style={{ fontSize: 15, fontWeight: 500, letterSpacing: "0.02em" }}>
            lingua
          </span>
          <LangpackSwitcher />
        </div>

        {units && units.length > 0 && (
          <div className="glass" style={{ display: "flex", gap: 28, padding: "16px 24px", borderRadius: 18, marginBottom: 52 }}>
            <div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 500 }}>{wordsUnlocked}</div>
              <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 2 }}>Words unlocked</div>
            </div>
          </div>
        )}

        {units === null && <p style={{ color: "var(--ink-soft)" }}>Loading your path…</p>}

        {units && units.length === 0 && (
          <p style={{ color: "var(--ink-soft)" }}>
            No curriculum found yet for this language. Run the one-time units setup script
            (<code>packages/core/tools/build_units.py</code>) to generate it.
          </p>
        )}

        {units && units.length > 0 && (
          <nav aria-label="Learning path" style={{ position: "relative" }}>
            <div
              aria-hidden="true"
              style={{
                position: "absolute", left: "50%", top: 30, bottom: 30,
                borderLeft: "2px dashed rgba(42,36,32,.15)", transform: "translateX(-50%)", zIndex: 0,
              }}
            />

            {windowStart > 0 && (
              <p className="mono" style={{ textAlign: "center", fontSize: 11, color: "var(--ink-soft)", marginBottom: 24 }}>
                {windowStart} earlier unit{windowStart === 1 ? "" : "s"} completed
              </p>
            )}

            {visible.map((unit, i) => {
              const index = windowStart + i;
              const isCurrent = index === currentIndex;
              return (
                <UnitNode
                  key={unit.id}
                  unit={unit}
                  index={index}
                  isCurrent={isCurrent}
                  justify={isCurrent ? "center" : JUSTIFY_CYCLE[index % JUSTIFY_CYCLE.length]}
                  nodeRef={isCurrent ? currentRef : null}
                  starting={starting}
                  onStart={startSession}
                />
              );
            })}

            {windowStart + visible.length < units.length && (
              <p className="mono" style={{ textAlign: "center", fontSize: 11, color: "var(--ink-soft)", marginTop: 8 }}>
                {units.length - windowStart - visible.length} more unit{units.length - windowStart - visible.length === 1 ? "" : "s"} ahead
              </p>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}

function UnitNode({ unit, index, isCurrent, justify, nodeRef, starting, onStart }) {
  const pct = Math.round(unit.score * 100);
  const deg = Math.round(unit.score * 360);
  const size = isCurrent ? 100 : 84;
  const innerSize = isCurrent ? 84 : 72;

  const ringStyle = unit.unlocked
    ? { background: `conic-gradient(var(--clay) 0deg ${deg}deg, rgba(42,36,32,.12) ${deg}deg 360deg)` }
    : { background: "rgba(42,36,32,.07)" };

  return (
    <div style={{ display: "flex", justifyContent: justify, marginBottom: 52, position: "relative", zIndex: 1 }}>
      <div ref={nodeRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: isCurrent ? 160 : 130 }}>
        {isCurrent && (
          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--clay-deep)", marginBottom: 8 }}>
            CONTINUE
          </div>
        )}

        <div
          style={{
            width: size, height: size, borderRadius: "50%", display: "flex",
            alignItems: "center", justifyContent: "center",
            boxShadow: isCurrent ? "0 0 0 8px rgba(192,106,62,.14)" : "none",
            ...ringStyle,
          }}
        >
          <div
            className={unit.unlocked ? "glass" : ""}
            style={{
              width: innerSize, height: innerSize, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: unit.unlocked ? undefined : "rgba(42,36,32,.04)",
              border: unit.unlocked ? undefined : "1px solid rgba(42,36,32,.08)",
            }}
          >
            <span className="mono" style={{ fontSize: isCurrent ? 20 : 18, color: unit.unlocked ? "var(--clay-deep)" : "var(--ink-soft)" }}>
              {String(index + 1).padStart(2, "0")}
            </span>
          </div>
        </div>

        <div style={{ marginTop: 10, textAlign: "center" }}>
          <div style={{ fontSize: isCurrent ? 15 : 14, fontWeight: isCurrent ? 700 : 600, color: unit.unlocked ? "var(--ink)" : "var(--ink-soft)" }}>
            {unit.name}
          </div>

          {!unit.unlocked && (
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: "0.06em", marginTop: 2 }}>
              LOCKED
            </div>
          )}

          {unit.unlocked && (
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 4 }}>
              <button
                type="button"
                className="mono"
                disabled={!!starting}
                onClick={() => onStart(unit, "review")}
                style={{ border: "none", background: "transparent", color: "var(--ink-soft)", fontSize: 10, letterSpacing: "0.06em", cursor: "pointer", textDecoration: "underline", padding: 0 }}
              >
                {starting === `${unit.id}:review` ? "…" : "REVIEW"}
              </button>
              <button
                type="button"
                className="mono"
                disabled={!!starting}
                onClick={() => onStart(unit, "chat")}
                style={{ border: "none", background: "transparent", color: "var(--ink-soft)", fontSize: 10, letterSpacing: "0.06em", cursor: "pointer", textDecoration: "underline", padding: 0 }}
              >
                {starting === `${unit.id}:chat` ? "…" : "CHAT"}
              </button>
            </div>
          )}

          {isCurrent && unit.unlocked && (
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 2 }}>{pct}%</div>
          )}
        </div>
      </div>
    </div>
  );
}
