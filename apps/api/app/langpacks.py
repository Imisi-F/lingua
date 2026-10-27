import os
import pathlib
from functools import lru_cache

from core import LangpackConfig, load_langpack


def _default_langpacks_root() -> pathlib.Path:
    repo_root = pathlib.Path(__file__).resolve().parents[3]
    return repo_root / "langpacks"


LANGPACKS_ROOT = pathlib.Path(os.environ.get("LANGPACKS_ROOT", str(_default_langpacks_root())))


@lru_cache
def get_langpack(name: str) -> LangpackConfig:
    return load_langpack(name, LANGPACKS_ROOT)
