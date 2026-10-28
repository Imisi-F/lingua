const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function playTts(langpack, text) {
  const res = await fetch(`${API_URL}/speech/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ langpack, text }),
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
