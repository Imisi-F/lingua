"use client";

import { useEffect, useState } from "react";

import { useLangpack } from "../LangpackContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ReviewPage() {
  const { langpack } = useLangpack() || {};
  const [item, setItem] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);

  // Switching langpacks mid-session should show that langpack's own queue,
  // not whatever was left on screen.
  useEffect(() => {
    setItem(null);
    setStarted(false);
  }, [langpack]);

  async function loadNext() {
    setLoading(true);
    setRevealed(false);
    const res = await fetch(`${API_URL}/review/next?langpack=${langpack}`);
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
      body: JSON.stringify({ item_id: item.item_id, rating }),
    });
    loadNext();
  }

  return (
    <main>
      <h1>Review queue</h1>
      {!langpack && <p>Loading…</p>}
      {langpack && !started && <button onClick={loadNext}>Start</button>}
      {loading && <p>Loading…</p>}
      {started && !loading && !item && <p>Nothing due right now. Come back later.</p>}
      {item && (
        <div>
          <p style={{ fontSize: "2rem" }}>{item.prompt}</p>
          {revealed ? (
            <>
              <p>{item.reading ? `${item.reading} — ${item.meaning}` : item.meaning}</p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={() => answer("again")}>Again</button>
                <button onClick={() => answer("hard")}>Hard</button>
                <button onClick={() => answer("good")}>Good</button>
                <button onClick={() => answer("easy")}>Easy</button>
              </div>
            </>
          ) : (
            <button onClick={() => setRevealed(true)}>Show answer</button>
          )}
        </div>
      )}
    </main>
  );
}
