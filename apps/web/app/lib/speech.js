const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// The persona writes replies with an English gloss in parentheses (by
// design - see langpacks/*/prompts/persona.md), but Piper/MMS only know
// Mandarin/Yoruba phonetics, so reading that English text out loud comes
// out heavily accented. Strip it before it ever reaches the TTS endpoint -
// the gloss still shows in the chat bubble, it just isn't spoken.
function stripGlosses(text) {
  return text.replace(/[(（][^)）]*[)）]/g, "").replace(/\s+/g, " ").trim();
}

export async function playTts(langpack, text) {
  const res = await fetch(`${API_URL}/speech/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ langpack, text: stripGlosses(text) }),
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  await audio.play();
}

export async function transcribe(langpack, audioBlob) {
  const form = new FormData();
  form.append("langpack", langpack);
  form.append("audio", audioBlob, "recording.webm");

  const res = await fetch(`${API_URL}/speech/transcribe`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) return "";
  const data = await res.json();
  return data.text || "";
}
