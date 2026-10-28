"use client";

import { createContext, useContext, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const LangpackContext = createContext(null);

export function LangpackProvider({ children }) {
  const [langpack, setLangpack] = useState(null);
  const [options, setOptions] = useState([]);

  useEffect(() => {
    let stored = null;
    try {
      stored = localStorage.getItem("langpack");
    } catch {
      // private browsing / blocked storage - fine, just no persistence
    }

    fetch(`${API_URL}/langpacks`)
      .then((res) => res.json())
      .then((list) => {
        setOptions(list);
        const match = list.find((l) => l.code === stored);
        setLangpack(match ? match.code : list[0]?.code || "mandarin");
      })
      .catch(() => setLangpack("mandarin"));
  }, []);

  function selectLangpack(code) {
    setLangpack(code);
    try {
      localStorage.setItem("langpack", code);
    } catch {
      // ignore - per-viewer convenience only
    }
  }

  return (
    <LangpackContext.Provider value={{ langpack, options, selectLangpack }}>
      {children}
    </LangpackContext.Provider>
  );
}

export function useLangpack() {
  return useContext(LangpackContext);
}
