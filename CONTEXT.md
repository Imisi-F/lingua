# Lingua — Project Context & Build Brief

This file is a complete brief for building **Lingua**: a personal, self-hosted
language-fluency app focused on **listening and speaking** (not reading/writing
drills), for two initial languages — **Yorùbá** and **Mandarin Chinese** — built
so a third language can be added later without touching core code.

Paste this whole file to an AI coding agent as the starting brief for the build.

---

## 1. Goal & design philosophy

The owner wants to get conversationally fluent in Yorùbá and Mandarin. Inspiration:
Praktika, SuperChinese, Lingvist. Explicitly **avoiding Duolingo's failure modes**:

- **No streak/XP-driven study loop.** Gamification can exist as light flavor, never
  as the mechanism deciding what to review.
- **Comprehensible input + forced spoken output**, not translation drilling.
  Sessions should be: hear/read a dialogue slightly above current level → respond
  out loud → get corrected → move on.
- **Real memory model, not fixed intervals.** Use FSRS (Free Spaced Repetition
  Scheduler), applied to "can I understand/produce this" items — not just vocab
  flashcards.
- **Authentic content** (real sentences, proverbs, native audio) over synthetic
  "the elephant is purple" sentences wherever a data source allows it.
- **Reading/writing are secondary.** Minimal UI surface for them; they exist only
  as support for vocab (e.g. showing pinyin/tone marks, Yorùbá diacritics) not as
  drills in themselves.

---

## 2. Finalized tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js (PWA) | Hosted on **Netlify** (owner already has domain there) |
| Backend | FastAPI (Python) | Hosted on **Fly.io** — persistent VM, not serverless (model inference needs a warm process + real disk) |
| Database | **Supabase** (Postgres) | Free tier. Stores user state, FSRS card state, conversation logs, error logs |
| Conversation LLM | **DeepSeek** (DeepSeek V4 chat API) | Cheapest viable option for high-volume conversation turns |
| SRS engine | **FSRS** via `py-fsrs` | Library only, not tied to Anki. Language-agnostic package |
| STT | **Self-hosted**, `faster-whisper` | Runs on the Fly.io backend VM, not a cloud API |
| TTS | **Self-hosted**: Piper (Mandarin), Meta MMS (Yorùbá) | Runs on the Fly.io backend VM |
| Model hub | Hugging Face | Source for MMS weights and Yorùbá Whisper fine-tunes |

No Docker is available on the dev machine — do not assume a container workflow.
Use native venv + npm/pnpm locally for development; Fly.io deploy can use its own
buildpack/Dockerfile-free `fly launch` flow (Fly can build from a Procfile-style
config — confirm current Fly.io deploy method without Dockerfile at build time).

### Why these choices (context the agent should preserve)
- Netlify Functions were ruled out for the backend: serverless, ~10-26s timeout,
  ephemeral disk, can't hold a warm Whisper/TTS process or large model weights.
- Realtime voice APIs (OpenAI Realtime, Gemini Live) were ruled out: ~$0.02-0.11/min,
  and near-certainly no real-time voice support for Yorùbá at all. A cascaded
  pipeline (self-hosted STT → cheap text LLM → self-hosted TTS) is cheaper and is
  the only way to keep Yorùbá and Mandarin on a symmetric architecture.
- SQLite was considered instead of Supabase, but Supabase was chosen since the
  backend is now hosted anyway and the owner's laptop has very limited disk (~4GB
  free) — keeping DB storage off the laptop entirely is one less constraint.

---

## 3. Architecture: core engine + language packs

The whole point of this structure is that **adding a new language later means
adding a new folder, not touching core code.**

```
/apps/web/              Next.js frontend (deployed to Netlify)
/apps/api/               FastAPI backend (deployed to Fly.io)
  /apps/api/stt/          faster-whisper wrapper
  /apps/api/tts/          Piper + MMS wrappers
  /apps/api/agents/       conversation / error-tracking / lesson-planner agents (DeepSeek calls)
/packages/srs/            FSRS scheduler — language-agnostic, pure logic
/packages/core/           conversation orchestration, prompt templating, session logic
/langpacks/
  /yoruba/
    config.yaml            phoneme set, TTS model id, STT model id/path, locale, diacritic rules
    seed-data/              pulled from MENYO-20k, ÌròyìnSpeech, Common Voice yo
    prompts/                persona + system prompts (culturally specific personas)
  /mandarin/
    config.yaml             phoneme set (pinyin+tones), TTS voice id, STT model id, locale
    seed-data/              HSK 3.0 lists, Tatoeba sentence pairs, Common Voice zh
    prompts/                persona + system prompts
```

A `langpacks/<lang>/config.yaml` should declare at minimum:
```yaml
code: yo              # ISO code
name: Yorùbá
stt_model: haramiday/owe-voice-whisper-small-yoruba   # or local fine-tune path
tts_engine: mms       # "piper" | "mms"
tts_voice: <voice id or MMS lang code>
seed_sentences: ./seed-data/sentences.jsonl
seed_vocab: ./seed-data/vocab.jsonl
persona_prompts_dir: ./prompts
```

Core code (`packages/core`, `apps/api`) must only ever read from this interface —
never hardcode "yoruba" or "mandarin" logic outside a langpack.

---

## 4. Data sources (per language)

**Mandarin:**
- HSK 3.0 word/grammar lists with frequency, pinyin, zhuyin — `krmanik/HSK-3.0` on
  GitHub (open license)
- Tatoeba sentence pairs
- Mozilla Common Voice `zh` audio (part of the multilingual Common Voice release)
- AnkiWeb shared HSK decks as supplementary seed vocab (check individual licenses)

**Yorùbá:**
- **ÌròyìnSpeech** — 23,000 real-speech sentences (news + creative writing),
  CC-BY-4.0. This is the best listening-content source available; prioritize it.
- **MENYO-20k** — multi-domain EN-Yorùbá corpus (news, proverbs, movie transcripts,
  tech localization) via the Masakhane project
- Mozilla Common Voice `yo` audio — ~8hrs, CC0
- Masakhane GitHub org for additional resources (MasakhaNER, MasakhaPOS, etc.)

Both languages: use DeepSeek to generate additional graded practice dialogues,
but **ground every generated sentence in the seed vocab/sentence banks above** —
do not let the LLM free-generate vocabulary outside what's been introduced via
SRS, or content will drift into unnatural "textbook-ese."

---

## 5. STT / TTS specifics

- **STT**: `faster-whisper` (CTranslate2 backend, no torch dependency, lighter
  than whisper.cpp to set up). Mandarin: `base` or `small` model is adequate.
  Yorùbá: zero-shot Whisper has published WER >100% — do **not** rely on a base
  Whisper model for Yorùbá. Start from `Haramiday/owe-voice-whisper-small-yoruba`
  (Hugging Face) or Meta MMS's ASR variant; evaluate accuracy before trusting it,
  and budget for fine-tuning on ÌròyìnSpeech later if quality disappoints.
- **TTS**: Piper for Mandarin (CPU, no heavy deps, download voice `.onnx` + config).
  Meta MMS for Yorùbá (needs `transformers`+`torch` — this is heavy, but it's fine
  now that it lives on the Fly.io VM, not the dev laptop). Note: MMS weights are
  **CC-BY-NC** — fine for this personal/non-commercial use, re-check if ever
  monetized.
- **Pronunciation feedback**: not required for v1. If added later, start from
  `OpenPronounce` (MIT, wav2vec2 + espeak-ng phoneme diffing) — note its scoring
  thresholds are calibrated for English only; other languages will need their own
  calibration pass eventually.

---

## 6. Conversation agent design

Modeled on how Praktika is actually built (per OpenAI's public case study):
**separate agents, not one mega-prompt.**

1. **Persona/conversation agent** — roleplays a character with a backstory, stays
   in the target language, adapts vocabulary to the learner's current level
   (pull level from FSRS state / known-vocab set). Handles the live turn-by-turn
   conversation. Uses DeepSeek for cost reasons (this runs on every turn).
2. **Error-tracking agent** — runs after each learner utterance, silently logs
   grammar/vocab/pronunciation mistakes without interrupting the conversation
   flow. Writes findings to the error log table in Supabase, which feeds the FSRS
   queue (mistakes should resurface sooner).
3. **Lesson-planner agent** — runs periodically (e.g. once per session or daily),
   reviews the error log + FSRS stats, and decides the next session's topic/focus
   and which persona to use. This runs far less often than agent #1, so it's fine
   to use a stronger model here if DeepSeek's reasoning proves insufficient —
   but default to DeepSeek for this too unless quality requires otherwise.

Latency target: cascaded STT→LLM→TTS will run ~1-3s round trip. This is an
accepted tradeoff for cost and Yorùbá support — do not try to optimize this away
in v1.

---

## 7. Suggested build order (phased)

Build in this order so there's a usable app at every phase, rather than a big-bang
build:

**Phase 1 — Core skeleton, text-only, Mandarin only**
- Scaffold repo structure above.
- `packages/srs`: FSRS wrapper with a minimal card model (item id, due date, state).
- Supabase schema: users (single-user is fine for v1), cards, conversation_log,
  error_log.
- `apps/api`: FastAPI skeleton, DeepSeek-backed persona agent, text-only chat
  endpoint (no audio yet).
- `apps/web`: minimal chat UI + a review queue screen driven by FSRS due cards.
- Seed Mandarin langpack from HSK 3.0 + Tatoeba.
- Deploy: Fly.io app + Supabase project + Netlify site wired together via env vars.

**Phase 2 — Add Yorùbá langpack**
- Mirror the Mandarin langpack structure with ÌròyìnSpeech/MENYO-20k seed data.
- Confirm the core app required zero language-specific code changes — this is the
  test of whether the langpack abstraction actually works.

**Phase 3 — Add speech**
- `apps/api/stt`: faster-whisper wrapper, browser mic capture via
  MediaRecorder/WebRTC, upload-and-transcribe endpoint.
- `apps/api/tts`: Piper wrapper (Mandarin) + MMS wrapper (Yorùbá).
- Wire persona agent responses through TTS; wire learner audio through STT before
  it reaches the persona/error-tracking agents.

**Phase 4 — Error-tracking + lesson-planner agents**
- Implement agent #2 and #3 from section 6.
- Error log → FSRS priority boosting.

**Phase 5 — Polish / optional**
- Pronunciation scoring (OpenPronounce) if STT/TTS quality in Phase 3 feels good
  enough to build on top of.
- Any UI polish, PWA install prompts, etc.

---

## 8. Explicit non-goals for v1

- No native mobile app (PWA via Netlify is sufficient).
- No multi-user auth/accounts — this is a single-user personal app.
- No reading/writing drill modes.
- No pronunciation scoring in the initial build (Phase 5, optional).
- No realtime voice API integration (OpenAI Realtime/Gemini Live) — intentionally
  using the cheaper cascaded pipeline instead.

## 9. Environment variables needed

```
# apps/api (.env, Fly.io secrets)
DEEPSEEK_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
HF_TOKEN=            # if any HF model download requires auth

# apps/web (Netlify env vars)
NEXT_PUBLIC_API_URL=https://<your-fly-app>.fly.dev
```

## 10. Accounts already decided

Fly.io (backend compute), Supabase (database), DeepSeek (conversation LLM),
Hugging Face (model weights), Netlify (frontend — already owned). STT and TTS are
self-hosted on the Fly.io VM, no separate accounts needed for those.
