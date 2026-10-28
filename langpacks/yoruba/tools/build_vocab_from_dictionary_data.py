"""One-off generator for langpacks/yoruba/seed-data/vocab.jsonl.

Source: temitope/yoruba-dictionary-data
(https://github.com/temitope/yoruba-dictionary-data) - 937 entries extracted
from English Wiktionary via kaikki.org. License: CC BY-SA 4.0 (ShareAlike -
the underlying Wiktionary data is CC BY-SA 3.0). If you redistribute
langpacks/yoruba/seed-data/vocab.jsonl, keep that attribution and license.

Usage:
    git clone --depth 1 https://github.com/temitope/yoruba-dictionary-data.git /tmp/yoruba-dict
    python3 build_vocab_from_dictionary_data.py /tmp/yoruba-dict

Orders by the source's own "difficulty" tier (easy -> medium -> hard, based
on token/syllable count) so FSRS introduces shorter words first, same idea
as HSK bands for Mandarin.
"""
import json
import sys
from pathlib import Path

DIFFICULTY_ORDER = {"easy": 0, "medium": 1, "hard": 2}
OUT_PATH = Path(__file__).resolve().parents[1] / "seed-data" / "vocab.jsonl"


def main(dict_repo_root: str) -> None:
    words_path = Path(dict_repo_root) / "data" / "words.json"
    words = json.loads(words_path.read_text(encoding="utf-8"))
    words.sort(key=lambda w: DIFFICULTY_ORDER.get(w.get("difficulty"), 99))

    entries = []
    for w in words:
        meaning = w.get("meanings", {}).get("en")
        if not meaning:
            continue
        entries.append(
            {
                "id": f"v{len(entries) + 1:04d}",
                "word": w["word"],
                "meaning": meaning,
                "level": w.get("difficulty", ""),
            }
        )

    with OUT_PATH.open("w", encoding="utf-8") as f:
        for entry in entries:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    print(f"Wrote {len(entries)} vocab entries to {OUT_PATH}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: build_vocab_from_dictionary_data.py <path-to-cloned-dictionary-repo>")
        sys.exit(1)
    main(sys.argv[1])
