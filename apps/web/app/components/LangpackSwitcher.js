"use client";

import { useLangpack } from "../LangpackContext";

export default function LangpackSwitcher() {
  const ctx = useLangpack();
  if (!ctx || !ctx.langpack) return null;

  return (
    <select
      value={ctx.langpack}
      onChange={(e) => ctx.selectLangpack(e.target.value)}
      style={{ padding: "0.4rem" }}
      aria-label="Active langpack"
    >
      {ctx.options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
