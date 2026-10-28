"""One-off generator for langpacks/yoruba/seed-data/sentences.jsonl.

Source: MENYO-20k (https://github.com/uds-lsv/menyo-20k_MT), a multi-domain
English-Yoruba parallel corpus (news, proverbs, books, Ted Talks, digital/ICT
text). License: CC BY-NC 4.0 - non-commercial use only. If you redistribute
langpacks/yoruba/seed-data/sentences.jsonl, keep that attribution and respect
the NC term.

Usage:
    git clone --depth 1 https://github.com/uds-lsv/menyo-20k_MT.git /tmp/menyo
    python3 build_sentences_from_menyo.py /tmp/menyo

MENYO's dev/test splits are mostly long, complex single sentences (it's a
machine-translation research corpus, not graded reading material) - two of
the per-domain files (dev_book.tsv, dev_tedTalks.tsv) don't even have a
header row. This script filters down to sentences with <= MAX_WORDS Yoruba
words, which is a crude but honest way to avoid asserting anything about
actual difficulty: the text is used verbatim from the corpus, nothing here
is rewritten or translated by this script.
"""
import csv
import json
import sys
from pathlib import Path

MAX_WORDS = 8
NO_HEADER_FILES = {"dev_book.tsv", "dev_tedTalks.tsv"}
DOMAIN_FILES = [
    "dev_digital.tsv", "test_digital.tsv",
    "dev_news.tsv", "test_news.tsv",
    "dev_proverbs.tsv", "test_proverbs.tsv",
    "dev_book.tsv", "test_book.tsv",
    "dev_tedTalks.tsv", "test_tedTalks.tsv",
]
OUT_PATH = Path(__file__).resolve().parents[1] / "seed-data" / "sentences.jsonl"


def domain_name(filename: str) -> str:
    return filename.removeprefix("dev_").removeprefix("test_").removesuffix(".tsv")


def main(menyo_repo_root: str) -> None:
    data_dir = Path(menyo_repo_root) / "data"
    seen_yoruba: set[str] = set()
    entries = []

    for filename in DOMAIN_FILES:
        path = data_dir / filename
        with path.open(encoding="utf-8") as f:
            rows = list(csv.reader(f, delimiter="\t"))
        if filename not in NO_HEADER_FILES:
            rows = rows[1:]

        for row in rows:
            if len(row) < 2:
                continue
            english = row[0].strip().lstrip("﻿")
            yoruba = row[1].strip().lstrip("﻿")
            if not english or not yoruba:
                continue
            if len(yoruba.split()) > MAX_WORDS:
                continue
            if yoruba in seen_yoruba:
                continue
            seen_yoruba.add(yoruba)
            entries.append(
                {
                    "id": f"s{len(entries) + 1:04d}",
                    "text": yoruba,
                    "translation": english,
                    "source": domain_name(filename),
                }
            )

    with OUT_PATH.open("w", encoding="utf-8") as f:
        for entry in entries:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    print(f"Wrote {len(entries)} sentence entries to {OUT_PATH}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: build_sentences_from_menyo.py <path-to-cloned-menyo-repo>")
        sys.exit(1)
    main(sys.argv[1])
