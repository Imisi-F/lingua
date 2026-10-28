# Data sources for this langpack

**`seed-data/vocab.jsonl`** (10,937 entries, HSK 1 through 7-9)
- Source: [krmanik/HSK-3.0](https://github.com/krmanik/HSK-3.0), the
  "HSK List (Meaning)" tsv files for the 2021 HSK 3.0 standard.
- License: CC-CEDICT data is CC BY-SA 4.0; the HSK 3.0 word list itself is
  credited to Pleco (MIT) in that repo's `License.md`. Keep attribution if
  you redistribute this file.
- Regenerate with `tools/build_vocab_from_hsk3.py` against a fresh clone of
  that repo if the upstream list ever updates.

**`seed-data/sentences.jsonl`** (12 entries)
- Hand-written for Phase 1, built only from words in `vocab.jsonl`'s original
  81-word starter set. Not sourced from a corpus - these are small enough
  that hand-authoring was lower-risk than it would be for Yorùbá (see
  `langpacks/yoruba/SOURCES.md` for why that langpack went a different way).
- Expanding this to a real Tatoeba import remains open (see `CONTEXT.md`).
