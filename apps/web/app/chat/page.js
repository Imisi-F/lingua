"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { playTts, transcribe } from "../lib/speech";
import { BackIcon, HistoryIcon, MicIcon, SendIcon, SpeakerIcon, StopIcon, WaveformIcon } from "../components/icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatContent />
    </Suspense>
  );
}

function ChatContent() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params.get("session");
  const unitName = params.get("unit") || "";
  const langpack = params.get("langpack") || "";

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function send() {
    if (!input.trim() || !sessionId) return;
    const text = input;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    const res = await fetch(`${API_URL}/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, text }),
    });
    const data = await res.json();
    setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    setSending(false);
  }

  async function endSession() {
    if (!sessionId || ending) return;
    setEnding(true);
    const res = await fetch(`${API_URL}/sessions/${sessionId}/end`, { method: "POST" });
    const summary = await res.json();
    try {
      sessionStorage.setItem("lingua_summary", JSON.stringify(summary));
    } catch {
      // ignore - summary page handles missing data
    }
    router.push("/summary");
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      setTranscribing(true);
      const text = await transcribe(langpack, blob);
      setTranscribing(false);
      if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="page-shell">
      <div className="atmosphere" aria-hidden="true">
        <div className="blob-moss" />
        <div className="blob-clay" />
      </div>

      <div className="page-content" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, gap: 12 }}>
          <button type="button" className="glass icon-btn" aria-label="Back to path" style={{ width: 40, height: 40 }} onClick={() => router.push("/")}>
            <BackIcon />
          </button>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{unitName}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: "0.06em", marginTop: 2 }}>
              CHAT PRACTICE
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              className="glass icon-btn"
              aria-label="Conversation history"
              style={{ width: 40, height: 40 }}
              onClick={() => router.push(`/history?langpack=${langpack}`)}
            >
              <HistoryIcon />
            </button>
            <button type="button" className="mono" onClick={endSession} disabled={ending} style={{ border: "none", background: "transparent", color: "var(--ink-soft)", fontSize: 10, letterSpacing: "0.05em", cursor: "pointer" }}>
              {ending ? "…" : "END"}
            </button>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 18 }}>
              <div style={{ maxWidth: "78%", display: "flex", gap: 8, alignItems: "flex-end", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                <div
                  className="glass"
                  style={{
                    borderRadius: m.role === "user" ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
                    padding: "14px 16px",
                    background: m.role === "user" ? "rgba(192,106,62,.14)" : undefined,
                    borderColor: m.role === "user" ? "rgba(192,106,62,.3)" : undefined,
                  }}
                >
                  <p style={{ margin: 0, fontSize: 17 }}>{m.content}</p>
                </div>
                {m.role === "assistant" && (
                  <button type="button" aria-label="Play audio" className="glass icon-btn" style={{ width: 30, height: 30, color: "var(--moss-deep)" }} onClick={() => playTts(langpack, m.content)}>
                    <SpeakerIcon />
                  </button>
                )}
                {m.role === "user" && m.spoken && (
                  <span aria-label="Sent by voice" title="Sent by voice" style={{ width: 22, height: 22, color: "var(--clay-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <WaveformIcon />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24 }}
        >
          <label htmlFor="chat-input" className="sr-only">Message</label>
          <div className="glass" style={{ flex: 1, borderRadius: 999, padding: "4px 6px 4px 18px", display: "flex", alignItems: "center", minWidth: 0 }}>
            <input
              id="chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type, or record, your reply…"
              style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", outline: "none", font: "16px var(--font-hanken), sans-serif", color: "var(--ink)", padding: "10px 0" }}
            />
          </div>
          <button
            type="button"
            aria-label={recording ? "Stop recording" : "Record"}
            className={`glass icon-btn ${recording ? "recording" : ""}`}
            style={{ width: 44, height: 44, color: "var(--ink-soft)" }}
            onClick={recording ? stopRecording : startRecording}
            disabled={!sessionId || transcribing}
          >
            {recording ? <StopIcon /> : <MicIcon />}
          </button>
          <button
            type="submit"
            aria-label="Send message"
            className="icon-btn"
            style={{ width: 44, height: 44, background: "var(--clay)", color: "var(--bone)", boxShadow: "0 8px 20px rgba(192,106,62,.35)" }}
            disabled={sending || !sessionId}
          >
            <SendIcon />
          </button>
        </form>
        {transcribing && <p className="mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 8 }}>Transcribing…</p>}
      </div>
    </div>
  );
}
