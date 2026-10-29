"""One-off generator for langpacks/<lang>/seed-data/units.json.

Shared across every langpack - genuinely cookie-cutter, no language-specific
code. Chunks seed-data/vocab.jsonl into ~28-word groups, restarting at each
`level` boundary (so a unit never mixes e.g. HSK1 and HSK2 words), then calls
DeepSeek once per chunk to name it from its actual words.

This is a one-time content-authoring step, not something the app calls at
runtime - run it yourself with your own DEEPSEEK_API_KEY. ~425 small calls
across both langpacks at the time this was written; at DeepSeek's per-token
rate that's a few cents, once, ever - not a recurring cost.

Usage (from apps/api's venv, so `openai` is already installed):
    export DEEPSEEK_API_KEY=sk-your-key
    python3 ../../packages/core/tools/build_units.py ../../langpacks/mandarin
    python3 ../../packages/core/tools/build_units.py ../../langpacks/yoruba
"""
import json
import os
import sys
from pathlib import Path

from openai import OpenAI

CHUNK_SIZE = 28

client = OpenAI(api_key=os.environ["DEEPSEEK_API_KEY"], base_url="https://api.deepseek.com")


def chunk(items: list[dict], size: int) -> list[list[dict]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def name_chunk(words: list[dict]) -> str:
    listing = "\n".join(f"- {w['word']} ({w.get('reading', '')}): {w['meaning']}" for w in words)
    prompt = (
        "Here is a list of vocabulary words for a language-learning app. "
        "Give this group a short topic name (1-3 words, e.g. 'Greetings', "
        "'Food & Drink', 'Numbers'), based on what the words actually have "
        "in common. Reply with ONLY the name, nothing else.\n\n"
        f"{listing}"
    )
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=20,
    )
    return response.choices[0].message.content.strip().strip('"')


def main(langpack_dir: str) -> None:
    root = Path(langpack_dir)
    vocab_path = root / "seed-data" / "vocab.jsonl"
    out_path = root / "seed-data" / "units.json"

    words = [
        json.loads(line)
        for line in vocab_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]

    by_level: dict[str, list[dict]] = {}
    for w in words:
        by_level.setdefault(w.get("level", ""), []).append(w)

    units = []
    for level_words in by_level.values():
        for group in chunk(level_words, CHUNK_SIZE):
            name = name_chunk(group)
            level = group[0].get("level", "")
            units.append(
                {
                    "id": f"u{len(units) + 1:04d}",
                    "name": name,
                    "level": level,
                    "vocab_ids": [w["id"] for w in group],
                }
            )
            print(f"{units[-1]['id']}: {name} ({len(group)} words, level {level})")

    out_path.write_text(json.dumps(units, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {len(units)} units to {out_path}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: build_units.py <path-to-langpacks/LANG-dir>")
        sys.exit(1)
    main(sys.argv[1])
