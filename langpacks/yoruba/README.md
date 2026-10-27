# Yorùbá langpack - stub (Phase 2)

Not built yet. When Phase 2 starts, mirror `langpacks/mandarin/`'s structure
exactly:

```
yoruba/
  config.yaml
  seed-data/vocab.jsonl
  seed-data/sentences.jsonl
  prompts/persona.md
```

Data sources to pull from (see `CONTEXT.md` section 4):
- ÌròyìnSpeech (23k real-speech sentences, CC-BY-4.0) - best source, prioritize
- MENYO-20k (multi-domain EN-Yorùbá corpus incl. proverbs, via Masakhane)
- Mozilla Common Voice `yo` (~8hrs, CC0)

No code changes to `apps/api`, `packages/srs`, or `packages/core` should be
required to add this langpack - if they are, that's a sign the core/langpack
boundary leaked somewhere in Phase 1 and should be fixed first.
