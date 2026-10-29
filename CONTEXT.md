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

Superseded by `apps/api/.env.example` and section 13 below, which reflect
what's actually implemented (this section originally guessed `SUPABASE_URL`/
`SUPABASE_SERVICE_KEY`; the real implementation connects to Postgres
directly via a single `DATABASE_URL`, not through Supabase's REST API - see
section 10). Kept only as a quick-glance list:

```
# apps/api (.env locally, Fly secrets in production)
DATABASE_URL=         # Supabase session pooler connection string - see .env.example
DEEPSEEK_API_KEY=
HF_TOKEN=             # optional, rate-limit relief for Phase 3's model downloads

# apps/web (Netlify env vars)
NEXT_PUBLIC_API_URL=https://imzlingua.fly.dev
```

## 10. Accounts already decided

Fly.io (backend compute), Supabase (database), DeepSeek (conversation LLM),
Hugging Face (model weights), Netlify (frontend — already owned). STT and TTS are
self-hosted on the Fly.io VM, no separate accounts needed for those.

Supabase project is created with "Enable Data API", "Automatically expose new
tables", and "Enable automatic RLS" all on. **None of this is used** — the
backend talks to Postgres directly via `DATABASE_URL` (SQLAlchemy), not through
the auto-generated PostgREST API, so these settings are harmless but inert for
this project. Don't build anything against the Data API later without
reconsidering RLS policies first, since tables created here have RLS enabled
with no policies, which blocks anonymous/PostgREST access by design (direct
Postgres connection as the `postgres` role bypasses this, which is why it works).

---

## 11. Build status (living section — update this as the build progresses)

**Decisions resolved in this round:**
- Frontend package manager: **npm** (not pnpm).
- Secrets: kept local to the owner's machine, never pasted into the build
  session. All code uses placeholder `.env.example` files.
- Mandarin Phase 1 seed data: **small starter set**, hand-curated (not yet a
  real HSK-3.0/Tatoeba import) — 81 common vocab items + 12 example sentences,
  built only from that vocab. Expanding this to the full HSK 3.0 list +
  Tatoeba corpus (section 4) is explicitly deferred, not forgotten.

**Phase 1 — implemented:**
- Repo scaffold matches section 3 exactly (`apps/web`, `apps/api`,
  `packages/srs`, `packages/core`, `langpacks/mandarin`, `langpacks/yoruba` stub).
- `packages/srs`: thin wrapper around the `fsrs` PyPI package (v6.x). Verified
  working: card creation, review scoring, dict round-trip serialization.
- `packages/core`: `LangpackConfig`/`load_langpack` — reads `config.yaml` +
  `seed-data/*.jsonl` + `prompts/*.md` from a langpack folder. Verified working
  against `langpacks/mandarin`.
- `apps/api` (FastAPI): `/health`, `/chat/message` (persona agent via DeepSeek,
  conversation history persisted to `conversation_log`), `/review/next` (FSRS
  due-card lookup, introduces new items from the langpack when nothing is due),
  `/review/answer` (scores a review, updates the card). Verified: app imports
  cleanly, all routes registered, `/health` returns 200, OpenAPI schema
  generates without error. **Not yet verified against a real Postgres/DeepSeek
  connection** — that happens when the owner runs it locally (section 12).
- `apps/web` (Next.js, plain JS, no TypeScript): `/` (nav), `/chat` (chat UI),
  `/review` (flashcard review UI). Talks to the API via
  `NEXT_PUBLIC_API_URL`. Not yet run (`npm install`/`npm run dev` not executed
  by the build session — needs Node, which isn't in this backend-focused
  sandbox check).
- `apps/api/migrations/001_init.sql`: creates `cards`, `conversation_log`,
  `error_log`. **Not yet applied** — owner must run this in the Supabase SQL
  Editor before first use (section 12).
- `fly.toml` + `apps/api/Dockerfile`: written, **not yet deployed**. Deploy is
  intentionally deferred until local testing passes (per owner's request).

**Status: step 1 passed** — owner confirmed chat + review work locally
against real Supabase + DeepSeek (worked through: old pip/Python 3.8 on the
dev machine, `postgresql://` vs `postgresql+psycopg://` scheme, Supabase's
IPv6-only direct connection needing the session pooler instead, DeepSeek
account needing prepaid balance). None of those were code bugs.

**Mandarin vocab expanded to full HSK 3.0 (this round):**
- `seed-data/vocab.jsonl` replaced: 81 hand-picked words -> **10,937 words**,
  HSK bands 1 through 7-9, from `krmanik/HSK-3.0` (real repo, cloned and
  verified). Deduped by simplified form, keeping the earliest/easiest band.
  Generation script + license notes: `langpacks/mandarin/tools/` and
  `langpacks/mandarin/SOURCES.md`.
- `sentences.jsonl` (12 hand-written sentences) is unchanged — a real Tatoeba
  import for sentences is still open.
- **Action needed**: the dev DB almost certainly has a few `cards` rows from
  early local testing using the old 3-digit ids (e.g. `mandarin:vocab:v001`),
  which no longer exist in the new list (ids are now 5-digit, `v00001` etc.)
  and will 500 with a `KeyError` if `/review/next` ever returns one. Clear
  them once, in the Supabase SQL Editor:
  ```sql
  delete from cards where langpack = 'mandarin';
  ```

**Phase 2 — Yorùbá langpack (this round):**
- Built for real, not a stub: `config.yaml`, `seed-data/vocab.jsonl` (937
  words), `seed-data/sentences.jsonl` (1,493 sentences), `prompts/persona.md`.
- **Nothing in this langpack was generated or translated by Claude.** Yorùbá
  tone marks and diacritics (ẹ, ọ, ṣ) are easy to get subtly wrong without
  being a fluent reader, so every word and sentence comes verbatim from a
  real cited corpus instead: vocab from `temitope/yoruba-dictionary-data`
  (Wiktionary via kaikki.org, CC BY-SA 4.0 — **ShareAlike**, keep attribution
  on any redistribution), sentences from `MENYO-20k`
  (`uds-lsv/menyo-20k_MT`, CC BY-NC 4.0 — **non-commercial only**), filtered
  to <=8-word sentences since MENYO is an MT research corpus (mostly long,
  complex sentences), not graded reading material. Full details, including a
  known data-quality caveat (one vocab entry uses a non-standard diacritic,
  likely a Wiktionary extraction artifact), are in
  `langpacks/yoruba/SOURCES.md`.
- **Confirmed the core/langpack boundary held**: adding Yorùbá required zero
  changes to `apps/api` route logic or `packages/srs`. It did require one
  real schema fix in `packages/core`: `VocabItem.reading` /
  `SentenceItem.reading` were non-optional, which baked in a Mandarin-specific
  assumption (every language needs a separate phonetic layer). Yorùbá's own
  orthography already encodes pronunciation, so `reading` is now `str = ""`
  with an empty default, and the frontend (`apps/web/app/review/page.js`)
  only shows it when non-empty. This is exactly the kind of leak Phase 2 was
  meant to surface.
- Also added, motivated by the ~100x jump in data size: `level` (free-form —
  HSK band for Mandarin, dictionary difficulty tier for Yorùbá) and `source`
  fields on the two item types, and switched `LangpackConfig.vocab` /
  `.sentences` from a plain `@property` (re-parsed the file on every access)
  to `functools.cached_property`, plus an id-indexed lookup for `get_item()`
  (was a linear scan — fine at 81 items, not at 10,937).
- `ÌròyìnSpeech` (the audio corpus Phase 3 will actually want) still has no
  confirmed public download location — not fabricating one, left for later.
- `ACTIVE_LANGPACK` in `.env` is now only a fallback default for callers that
  don't specify one. A UI switcher was added after this round (see below).

**UI langpack switcher (this round):**
- `GET /langpacks` lists every langpack found under `langpacks/` (scans the
  directory rather than hardcoding the two we have — a third langpack shows
  up automatically). `/chat/message` now takes an optional `langpack` field
  and `/review/next` an optional `?langpack=` query param; both fall back to
  `ACTIVE_LANGPACK` if omitted.
- Frontend: `apps/web/app/LangpackContext.js` fetches the list once, persists
  the selection to `localStorage`, and a `<select>` in the root layout
  (`components/LangpackSwitcher.js`) is visible on every page. Both `/chat`
  and `/review` read the selection from context and reset their local state
  (chat history / review item) when it changes, so switching mid-session
  doesn't mix languages in one thread or show the wrong queue.
- Verified: backend `/langpacks` returns both langpacks; `npm run build`
  compiles the frontend cleanly with no new errors.

**Phase 3 — speech (this round):**
- Decision: the owner chose to deploy the backend to Fly.io *before* building
  Phase 3, specifically because Yoruba TTS (Meta MMS) needs `torch`+
  `transformers`, which would've reintroduced the laptop disk-space
  constraint from earlier. Mandarin TTS (Piper) and STT (`faster-whisper`,
  both languages) don't have that problem, but everything moved to Fly
  together rather than splitting dev workflows.
- `apps/api/app/speech/`: `stt.py` (faster-whisper, `int8` on CPU, same code
  path for both langpacks), `tts_piper.py` (Mandarin), `tts_mms.py` (Yoruba).
  New `POST /speech/transcribe` (multipart audio upload -> text) and
  `POST /speech/synthesize` (text -> WAV bytes, dispatches on the langpack's
  `tts_engine` config field).
- `packages/core`: added `LangpackConfig.whisper_language` (separate from
  `code` - Whisper's language codes aren't always the langpack's own id).
- Frontend: `/chat` got a record button (MediaRecorder -> `/speech/transcribe`
  -> fills the input for review before sending, doesn't auto-send - rough
  transcription on a low-resource language like Yoruba is worth a glance
  first) and a 🔊 play button per tutor reply. `/review` got a 🔊 play button
  on the prompt (reinforces listening during flashcard review, which is the
  whole point of this app). Shared fetch helpers in `apps/web/app/lib/speech.js`.
- **Real, verified choices, not placeholders**: `facebook/mms-tts-yor`
  (confirmed exists, CC-BY-NC-4.0, VITS) and `rhasspy/piper-voices`'s
  `zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx` (confirmed exists, 63.2MB)
  were both checked before being wired in, not assumed from the original
  Phase 1/2 placeholder comments.
- **Known gap, intentionally not fixed yet**: Yoruba STT still uses the plain
  multilingual `base` Whisper size, not `Haramiday/owe-voice-whisper-small-yoruba`
  from `langpacks/yoruba/config.yaml`'s old comment - `faster-whisper` only
  loads CTranslate2-format models, and that fine-tune is a plain transformers
  checkpoint. Using it would mean converting it first with
  `ct2-transformers-converter`. Wiring the pipeline now with known-rough
  accuracy (per the published >100% zero-shot WER) was judged more valuable
  than blocking on that conversion.
- **A real undeclared dependency was caught by actually importing the code,
  not assumed**: `piper-tts`'s Chinese phonemizer (`piper.phonemize_chinese`,
  used by the `zh_CN-huayan` voice) imports `unicode_rbnf` but doesn't list it
  as a dependency - omitting it would break Mandarin TTS specifically. Also
  needed: `python-multipart` (FastAPI's `Form()`/`UploadFile` silently
  require it - caught the same way, by actually running the import).
- **Verified**: `app.main` imports cleanly with the full Phase 3 dependency
  set installed (faster-whisper, piper-tts, transformers, torch, etc.), all
  routes register, `/health` and `/langpacks` still respond correctly,
  `npm run build` compiles the new frontend code with no errors.
- **Not verified - couldn't be, from this environment**: actual audio
  in/out. `huggingface.co` and `download.pytorch.org` are both blocked by
  this dev session's network policy, so neither the Piper voice file, the
  MMS model, nor a faster-whisper model could actually be downloaded here to
  run real transcription/synthesis. Fly's build environment has normal
  internet access, so this isn't expected to be a problem there - but the
  first real test of actual audio is the owner's, after deploying (section 13).

**Deployed to Fly as `imzlingua` (owner, after this round) - found a real bug
the sandbox couldn't catch**: first real Yoruba TTS request OOM-killed the
process. `fly.toml`'s `[[vm]] memory` was `512mb`, fine for the text-only
Phase 1/2 backend, but `torch`+`transformers` loading the MMS model pushed
`anon-rss` to ~395MB against that 512MB ceiling (confirmed via `fly logs`,
not guessed). Bumped to `2048mb`. This is exactly the kind of thing that
couldn't have been caught before real deployment, given `huggingface.co`/
`download.pytorch.org` were blocked in the dev sandbox - noted here so the
next langpack's author doesn't have to rediscover it.

**TTS (both languages) confirmed working after the memory fix. STT then
failed** on both `/speech/transcribe` calls: `av.open() got an unexpected
keyword argument 'metadata_errors'`. Root cause, confirmed by actually
installing and testing multiple `av` (PyAV) versions, not guessed:
`faster-whisper==1.2.1`'s audio decoding calls `av.open(..., metadata_errors=...)`,
a parameter PyAV removed somewhere around v16 - `faster-whisper` doesn't pin
an upper bound on `av`, so an unpinned install grabs the newest `av` (19.0.2
at the time) and breaks. Fixed by pinning `av>=14.0,<16.0` in
`requirements.txt`; verified `decode_audio()` works against a locally
generated silent WAV with that pin (no internet/model needed for that part).
Not yet re-verified against a real recording on Fly.

**Not yet done (in order):**
1. Owner redeploys with the `av` pin and confirms STT actually transcribes
   real speech (TTS already confirmed working for both languages).
2. Real Tatoeba import for `langpacks/mandarin/seed-data/sentences.jsonl`
   (still the 12 hand-written ones).
3. Swap the owner's Netlify site to this repo (frontend) - still deferred
   until the owner asks for it; can happen independently of Fly.
4. Phase 4 (error-tracking + lesson-planner agents), Phase 5 (pronunciation
   scoring) - untouched, as planned. Converting the Yoruba Whisper fine-tune
   to CTranslate2 (noted above) is a good candidate to fold into whichever of
   these picks up Yoruba STT accuracy work.

---

## 12. Local development — exact commands

**Backend:**
```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e ../../packages/srs -e ../../packages/core
pip install -r requirements.txt
cp .env.example .env               # then fill in DATABASE_URL and DEEPSEEK_API_KEY
uvicorn app.main:app --reload --port 8000
```

**Frontend (separate terminal):**
```bash
cd apps/web
npm install
cp .env.local.example .env.local   # defaults to http://localhost:8000, fine as-is
npm run dev
```

Then open http://localhost:3000.

**Database:** before first run, open the Supabase project's SQL Editor and run
the contents of `apps/api/migrations/001_init.sql` once.

---

## 13. Deploying the backend to Fly.io — exact commands

Run these from the repo root (not `apps/api`) - `fly.toml` there points at
`apps/api/Dockerfile` with the repo root as build context, since the
Dockerfile needs to `COPY` from `packages/` and `langpacks/` too. No local
Docker install needed - Fly builds the image on its own remote builder.

```bash
# one-time: install flyctl if you haven't
curl -L https://fly.io/install.sh | sh

fly auth login

# create the app (names are globally unique on Fly - "lingua-api" was
# already taken, so the real app is named "imzlingua"; fly.toml's `app =`
# line must match whatever name you actually get, or every later fly
# command silently targets an app you don't own and fails with
# "unauthorized" rather than a clearer error)
fly apps create imzlingua

# secrets - same values as your local apps/api/.env
fly secrets set DATABASE_URL="postgresql+psycopg://postgres.lbxifjpdpookjlnenjcu:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres"
fly secrets set DEEPSEEK_API_KEY="sk-your-deepseek-key"

# optional (Phase 3+): avoids unauthenticated-request rate limits on model
# downloads (MMS, faster-whisper) - huggingface.co/settings/tokens, Read
# access is enough. huggingface_hub picks this env var up automatically,
# no code change needed. `fly secrets set` triggers its own restart.
fly secrets set HF_TOKEN="hf_your_token_here"

# deploy (this is what actually builds the Docker image remotely and ships it)
fly deploy
```

Once it's up:
```bash
curl https://imzlingua.fly.dev/health   # should return {"status":"ok"}
```

Then point the frontend at it instead of localhost - edit
`apps/web/.env.local`:
```
NEXT_PUBLIC_API_URL=https://imzlingua.fly.dev
```
and restart `npm run dev`. Chat and review should work exactly as they did
against `localhost:8000` - and this is the first real chance to test actual
audio in/out, since `huggingface.co`/`download.pytorch.org` were blocked in
the dev sandbox that built Phase 3 (section 11 explains why).

**If `fly deploy` fails** (most likely spots, given what's untested): the
`curl` steps baking in the Piper voice file, or the CPU-torch index URL
being unreachable from Fly's builder (unlikely, but it's the one network
dependency in the Dockerfile that wasn't verified from this session - see
section 11). Send me the build log output and I'll fix it.

---

## 14. The learning path (units, sessions, confidence scoring)

This is a real UI rebuild plus real new backend mechanics - not a reskin.
Owner approved a full build with two constraints: minimize LLM usage in the
underlying logic (prefer math/algorithms), and design the curriculum
structure together before implementing. Streak tracking was explicitly
dropped - there is no streak anywhere in this feature.

### The model

- **Unit** = ~28 vocab words, chunked mechanically from `seed-data/vocab.jsonl`
  in `level` order (chunking restarts at each level boundary, so a unit never
  mixes e.g. HSK1 and HSK2 words). Pure arithmetic, zero curation effort.
  Mandarin: 392 units. Yorùbá: 35 units.
- **One node type, not two.** The original wireframe had separate
  REVIEW/CHAT nodes; re-reading the owner's actual request ("unlock circles
  ... using chat or review") led to dropping that split. Every unlocked unit
  offers both a Review and a Chat entry point, and *either* activity can
  raise that unit's score.
- **Confidence score = pure math, no LLM.** Built on FSRS `stability` (days),
  not point-in-time `retrievability` - retrievability was tried first and
  rejected after empirical testing showed it can't distinguish a just-correct
  from a just-wrong answer (elapsed time is ~0 right after any review
  either way, so retrievability is ~1 regardless of rating; stability
  doesn't have that problem). Formula, in `apps/api/app/units.py`:
  ```
  word_confidence = min(stability_days / 21, 1.0)   # 0 if never introduced
  unit_score = average(word_confidence over the unit's words)
  ```
  Next unit unlocks once the one before it reaches `unit_score >= 0.7`
  (`UNLOCK_THRESHOLD`).
- **Chat's contribution is algorithmic too**: `apps/api/app/routers/chat.py`'s
  `_credit_words_used` does a plain substring match of the active unit's
  words against what the learner typed, and feeds any hit into the *same*
  FSRS card as an automatic "good" rating. No LLM judges the conversation.
  Known limitation: misses inflected/conjugated forms, exact match only.
- **The one LLM call in this whole feature**: `_generate_feedback` in
  `apps/api/app/routers/sessions.py`, fired once per "End session" click
  (not per message, not per review) - given the session's actual word
  ratings and score, asked for 1-2 concrete sentences. Confirmed working via
  the integration test below (mocked, so the real wording wasn't seen, but
  the call shape and data it's given were verified).
- **Topic names are a one-time cost, not a runtime one.**
  `packages/core/tools/build_units.py` calls DeepSeek once per chunk (~425
  calls total across both langpacks, a few cents, once, ever) and writes the
  name into `units.json`. The app never calls DeepSeek for naming at runtime.

### New data model

- `langpacks/<lang>/seed-data/units.json` - generated by the script above,
  **not present yet** (see "what you need to do"). `LangpackConfig.units`
  (`packages/core`) returns `[]` gracefully if it's missing, so nothing
  crashes - the Path screen just shows an empty-state message instead.
- `sessions` table (`apps/api/migrations/002_sessions.sql`): one row per
  chat-or-review activity against a unit. `started_at`/`ended_at`/`score`/
  `feedback` all live here.
- `review_events` table: one row per FSRS rating, whether from an explicit
  review answer (`source='review'`) or the chat heuristic
  (`source='chat'`) - this is what lets Summary/History show "words touched
  this session" without re-parsing conversation text.
- **Everything is now session-scoped, not langpack-param-scoped.**
  `/chat/message`, `/review/next`, `/review/answer` all take a `session_id`
  and resolve langpack + unit server-side from the `sessions` row - the
  per-request `langpack` query param from the UI-switcher round is gone.
  Flow: `POST /sessions/start {langpack, unit_id, activity}` → `session_id`
  → use it on `/chat` or `/review` endpoints → `POST /sessions/{id}/end` →
  score + feedback + stats for the Summary screen.

### New/changed endpoints

| Endpoint | What changed |
|---|---|
| `GET /units?langpack=` | New. Every unit with `score`/`unlocked`, one DB query regardless of unit count. |
| `POST /sessions/start` | New. |
| `POST /sessions/{id}/end` | New. Computes final score, fires the one LLM feedback call, returns everything the Summary screen needs. |
| `GET /sessions?langpack=` | New. History list, works with or without the filter. |
| `GET /review/next` | Now takes `session_id`, not `langpack`. New-card introduction is scoped to the session's **unit** (`unit.vocab_ids`), not the whole langpack catalog - this is what makes the path mean something. Due-card lookup stays langpack-wide (cross-unit spaced repetition is intentional). |
| `POST /review/answer` | Now takes `session_id`; logs a `review_events` row. |
| `POST /chat/message` | Now takes `session_id` only (no `langpack`/`text`-only like before - langpack resolved from the session); runs the vocab-detection heuristic after each reply. |

`sentences.jsonl` is **no longer part of the active review flow** - units
are vocab-only (decided during the design discussion: splitting sentences
into units wasn't worth the complexity for v1). The data isn't deleted; it's
dormant until a chat-grounding use case picks it back up.

### Frontend rebuild

Whole new visual system, matching the approved wireframe
(`https://claude.ai/artifact/NohBUQncxprTws1mbdzaL5`) with Fraunces/Inter-style
AI-generated-site tropes deliberately avoided (no emoji - every icon is a
hand-drawn stroke SVG in `apps/web/app/components/icons.js`; no left-border
cards; no 3-up icon+bullet grids):

- `apps/web/app/design.css` - earthy palette, `.glass` utility, shared
  button/pill styles. Fonts via `next/font/google` (self-hosted by Next, not
  a runtime Google Fonts request) - Hanken Grotesk + Space Mono.
- `apps/web/app/page.js` - the Path screen, now the actual home page (the
  old "pick chat or review" landing page is gone). Winding node path driven
  by real `/units` data, windowed client-side to ~15 visible nodes around
  the current frontier (Mandarin's 392 units would otherwise mean an
  enormous DOM/scroll). Langpack switcher lives here only, not globally.
  **No streak stat** - only "Words unlocked" (sum of `word_count` across
  unlocked units), per the owner's explicit ask this round.
- `apps/web/app/chat/page.js`, `review/page.js` - restyled, now read
  `session`/`unit`/`langpack` from the URL (set by Path when it starts a
  session) instead of a global langpack context. "End" calls
  `/sessions/{id}/end` and hands off to Summary via `sessionStorage` (no
  backend round-trip needed just to pass data between two pages).
- `apps/web/app/history/page.js`, `summary/page.js` - new.
- **Two wireframe decorations dropped** for lack of cheap real data: the
  Chat screen's "words reinforced" chip strip, and the Review screen's
  position-in-set progress dots. Both were illustrative in the mockup;
  building real data for them would mean new endpoints not worth it yet.
  Review's stat strip instead shows "reviewed this session" (a simple local
  counter) rather than the wireframe's "today" framing.

### Verified, not assumed

Given how much of this is new mechanics (not just styling), verification
went further than earlier rounds:
- `packages/srs`/`app/units.py` scoring tested directly with real FSRS
  cards (confirmed the retrievability-vs-stability issue above empirically,
  not by reasoning about it).
- **A real Postgres instance was started in the dev sandbox** (Postgres 16
  was already installed there) specifically to run both migrations and
  exercise `/sessions/start` → `/review/next` → `/review/answer` →
  `/units` → `/sessions/{id}/end` → `/chat/message` → `/sessions` as actual
  HTTP calls against a real database, with `chat_completion` mocked (no real
  DeepSeek key available here). **This caught a real bug**: `_credit_words_used`
  constructed a new `CardRow` and incremented `.reps` in the same function
  call, before any flush - SQLAlchemy's `default=0` only applies at INSERT
  time, so `.reps` was still `None` in Python and `None + 1` crashed. Fixed
  by setting `reps=0, lapses=0` explicitly at construction.
- `npm run build` compiles all 6 routes clean.
- **The real dev servers were started** (FastAPI against the test Postgres,
  `next dev`) and driven with Playwright (Chromium, already installed in
  this sandbox) at phone width: loaded the Path screen, confirmed it
  visually matches the wireframe (screenshots taken), clicked into Review,
  ran a full reveal → rate → next-card cycle, confirmed the reviewed-count
  incremented and a new word loaded, checked History renders with no
  console errors. All backend processes/temp files/test data from this were
  torn down afterward - nothing left running, nothing committed.
- **Not verified**: a real chat exchange or a real session-end feedback
  message end to end (both need a live DeepSeek key, same constraint as
  every other round that touched `/chat`), and the actual unlock-at-0.7
  transition under realistic multi-day spaced repetition (the math was unit
  tested directly instead - simulating "days passing" isn't practical from
  a one-shot script).

### What you need to do

1. **Run the migration**: `apps/api/migrations/002_sessions.sql`, same way
   as before (Supabase SQL Editor).
2. **Generate the curriculum** (required - the Path screen is empty without
   it): from your `apps/api` venv,
   ```bash
   export DEEPSEEK_API_KEY=sk-your-key
   python3 ../../packages/core/tools/build_units.py ../../langpacks/mandarin
   python3 ../../packages/core/tools/build_units.py ../../langpacks/yoruba
   ```
   Takes a few minutes (≈425 small DeepSeek calls total, sequential). Commit
   the two generated `units.json` files afterward - they're real app data,
   not a build artifact to .gitignore.
3. Pull, reinstall (`pip install -r requirements.txt` picked up nothing new
   this round, but the repo structure changed), restart both dev servers,
   and try the path end to end.
4. If you're running on Fly, this needs a redeploy (`fly deploy`) once
   you're happy locally - same as every round that touched `apps/api`.
