# Data sources for this langpack

Unlike Mandarin, nothing here was hand-written. Yorùbá orthography (tone
marks, ẹ/ọ/ṣ) is easy to get subtly wrong without being a fluent reader, so
every entry in this langpack comes verbatim from an existing, citable corpus
rather than being generated or translated by an LLM or by Claude.

**`seed-data/vocab.jsonl`** (937 entries)
- Source: [temitope/yoruba-dictionary-data](https://github.com/temitope/yoruba-dictionary-data),
  itself extracted from English Wiktionary via kaikki.org.
- License: CC BY-SA 4.0 (the underlying Wiktionary data is CC BY-SA 3.0) -
  **ShareAlike**: if you redistribute this file or a derivative of it, it
  must carry the same license.
- Ordered by the source's own difficulty tier (easy -> medium -> hard, based
  on token/syllable count), same idea as HSK bands for Mandarin.
- Known caveat: this is community-edited Wiktionary data, so expect some
  noise (e.g. at least one entry, "Ụgọgọ", uses an underdot on "u", which
  isn't standard Yorùbá orthography - likely a dialectal form or a Wiktionary
  extraction artifact). Not hand-corrected; flagging rather than silently
  "fixing" entries I'm not confident about.
- Regenerate with `tools/build_vocab_from_dictionary_data.py`.

**`seed-data/sentences.jsonl`** (1,493 entries)
- Source: [MENYO-20k](https://github.com/uds-lsv/menyo-20k_MT), a
  multi-domain English-Yorùbá parallel corpus (news, proverbs, books, Ted
  Talks, digital/ICT text).
- License: **CC BY-NC 4.0 - non-commercial only.**
- MENYO is a machine-translation research corpus, not graded reading
  material - most of its sentences are long and complex. This file keeps
  only sentences with 8 or fewer Yorùbá words, pulled verbatim with no
  rewriting, as a crude but honest proxy for "simple enough to be a review
  item." Proverbs in particular are idiomatic even when short, so expect
  some entries where the literal words are simple but the meaning isn't.
- Regenerate with `tools/build_sentences_from_menyo.py`.

See `CONTEXT.md` section 4 for why ÌròyìnSpeech (the best-fit source once
Phase 3 needs actual audio) isn't included yet - no confirmed public
download location was found when this langpack was built.
