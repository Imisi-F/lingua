"""One-off generator for langpacks/mandarin/seed-data/vocab.jsonl.

Source: krmanik/HSK-3.0 (https://github.com/krmanik/HSK-3.0), the
"HSK List (Meaning)" tsv files for HSK 3.0 (2021) bands 1-6 and 7-9.
License for this word-level data per that repo's License.md: CC-CEDICT
(CC BY-SA 4.0) + the HSK 3.0 word list itself (MIT, via Pleco forums).
If you redistribute langpacks/mandarin/seed-data/vocab.jsonl, keep that
attribution.

Usage:
    git clone --depth 1 https://github.com/krmanik/HSK-3.0.git /tmp/hsk3
    python3 build_vocab_from_hsk3.py /tmp/hsk3

Dedupes by simplified form, keeping the first (lowest/easiest band) entry.
Output is intentionally committed to the repo - this script is provenance,
not something that needs to be re-run unless the upstream list changes.
"""
import csv
import json
import sys
from pathlib import Path

LEVELS = ["1", "2", "3", "4", "5", "6", "7-9"]
OUT_PATH = Path(__file__).resolve().parents[1] / "seed-data" / "vocab.jsonl"


def main(hsk3_root: str) -> None:
    root = Path(hsk3_root)
    seen: set[str] = set()
    entries = []

    for level in LEVELS:
        path = root / "New HSK (2021)" / "HSK List (Meaning)" / f"HSK {level}.tsv"
        with path.open(encoding="utf-8") as f:
            for row in csv.reader(f, delimiter="\t"):
                if len(row) < 4:
                    continue
                _traditional, simplified, pinyin, meaning = row[0], row[1], row[2], row[3]
                simplified = simplified.strip()
                if not simplified or simplified in seen:
                    continue
                seen.add(simplified)
                entries.append(
                    {
                        "id": f"v{len(entries) + 1:05d}",
                        "word": simplified,
                        "meaning": meaning.strip().rstrip(","),
                        "reading": pinyin.strip(),
                        "level": level,
                    }
                )

    with OUT_PATH.open("w", encoding="utf-8") as f:
        for entry in entries:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    print(f"Wrote {len(entries)} vocab entries to {OUT_PATH}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: build_vocab_from_hsk3.py <path-to-cloned-HSK-3.0-repo>")
        sys.exit(1)
    main(sys.argv[1])
