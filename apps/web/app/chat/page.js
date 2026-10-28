"use client";

import { useEffect, useState } from "react";

import { useLangpack } from "../LangpackContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ChatPage() {
  const { langpack } = useLangpack() || {};
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // A session's history is all one langpack's conversation - switching
  // langpacks starts a fresh one rather than mixing languages in one thread.
  useEffect(() => {
    setSessionId(null);
    setMessages([]);
  }, [langpack]);

  async function send() {
    if (!input.trim() || !langpack) return;
    const text = input;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    const res = await fetch(`${API_URL}/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, langpack, text }),
    });
    const data = await res.json();
    setSessionId(data.session_id);
    setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    setSending(false);
  }

  return (
    <main>
      <h1>Chat practice</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
        {messages.map((m, i) => (
          <p key={i}>
            <strong>{m.role === "user" ? "You" : "Tutor"}:</strong> {m.content}
          </p>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type in your target language or English..."
          style={{ flex: 1, padding: "0.5rem" }}
        />
        <button onClick={send} disabled={sending || !langpack}>
          Send
        </button>
      </div>
    </main>
  );
}
