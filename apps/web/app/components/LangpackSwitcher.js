"use client";

import { useLangpack } from "../LangpackContext";

export default function LangpackSwitcher() {
  const ctx = useLangpack();
  if (!ctx || !ctx.langpack) return null;

  return (
    <div className="glass" style={{ display: "inline-flex", padding: 4, borderRadius: 999 }}>
      {ctx.options.map((o) => (
        <button
          key={o.code}
          type="button"
          className={`toggle-btn ${ctx.langpack === o.code ? "active" : ""}`}
          onClick={() => ctx.selectLangpack(o.code)}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}
