"use client";

import { useEffect, useRef, useState } from "react";

import { useLangpack } from "../LangpackContext";
import { playTts, transcribe } from "../lib/speech";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ChatPage() {
  const { langpack } = useLangpack() || {};
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

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
      // Fill the input rather than auto-sending - transcription on a
      // low-resource language like Yoruba can be rough, worth a glance
      // before it goes to the tutor.
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
    <main>
      <h1>Chat practice</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
        {messages.map((m, i) => (
          <p key={i}>
            <strong>{m.role === "user" ? "You" : "Tutor"}:</strong> {m.content}
            {m.role === "assistant" && (
              <button
                onClick={() => playTts(langpack, m.content)}
                title="Play audio"
                style={{ marginLeft: "0.5rem" }}
              >
                🔊
              </button>
            )}
          </p>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type, or record, in your target language..."
          style={{ flex: 1, padding: "0.5rem" }}
        />
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={!langpack || transcribing}
          title={recording ? "Stop recording" : "Record"}
        >
          {recording ? "⏹" : "🎤"}
        </button>
        <button onClick={send} disabled={sending || !langpack}>
          Send
        </button>
      </div>
      {transcribing && <p>Transcribing…</p>}
    </main>
  );
}
