"""Loads a langpacks/<name>/ directory into a LangpackConfig.

This is the whole point of the "cookie-cutter" architecture: the API and the
conversation agents only ever talk to this interface. Adding a language means
adding a new langpacks/<name>/ folder that satisfies this shape - no changes
here, in apps/api, or in packages/srs.
"""
from __future__ import annotations

import json
import pathlib
from dataclasses import dataclass


@dataclass
class VocabItem:
    id: str
    word: str
    reading: str
    meaning: str


@dataclass
class SentenceItem:
    id: str
    text: str
    reading: str
    translation: str


@dataclass
class LangpackConfig:
    code: str
    name: str
    tts_engine: str
    tts_voice: str
    stt_model: str
    root: pathlib.Path
    raw: dict

    @property
    def vocab(self) -> list[VocabItem]:
        path = self.root / self.raw["seed_vocab"]
        return [VocabItem(**json.loads(line)) for line in _read_jsonl(path)]

    @property
    def sentences(self) -> list[SentenceItem]:
        path = self.root / self.raw["seed_sentences"]
        return [SentenceItem(**json.loads(line)) for line in _read_jsonl(path)]

    def persona_prompt(self, name: str = "persona") -> str:
        path = self.root / self.raw["persona_prompts_dir"] / f"{name}.md"
        return path.read_text(encoding="utf-8")

    def all_items(self) -> list[tuple[str, str]]:
        """(item_id, item_type) pairs for every seed item, namespaced by langpack."""
        items: list[tuple[str, str]] = []
        for v in self.vocab:
            items.append((f"{self.code}:vocab:{v.id}", "vocab"))
        for s in self.sentences:
            items.append((f"{self.code}:sentence:{s.id}", "sentence"))
        return items

    def get_item(self, item_id: str) -> VocabItem | SentenceItem:
        _, item_type, local_id = item_id.split(":", 2)
        pool = self.vocab if item_type == "vocab" else self.sentences
        for item in pool:
            if item.id == local_id:
                return item
        raise KeyError(item_id)


def _read_jsonl(path: pathlib.Path):
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield line


def load_langpack(name: str, langpacks_root: pathlib.Path) -> LangpackConfig:
    import yaml

    root = langpacks_root / name
    raw = yaml.safe_load((root / "config.yaml").read_text(encoding="utf-8"))
    return LangpackConfig(
        code=raw["code"],
        name=raw["name"],
        tts_engine=raw.get("tts_engine", ""),
        tts_voice=raw.get("tts_voice", ""),
        stt_model=raw.get("stt_model", ""),
        root=root,
        raw=raw,
    )
