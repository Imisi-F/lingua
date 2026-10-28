from fastapi import APIRouter
from pydantic import BaseModel

from ..langpacks import LANGPACKS_ROOT, get_langpack

router = APIRouter(prefix="/langpacks")


class LangpackInfo(BaseModel):
    code: str
    name: str


@router.get("")
def list_langpacks() -> list[LangpackInfo]:
    """Drives the frontend's langpack switcher - scans langpacks/ rather than
    hardcoding the two we have, so a third langpack just shows up."""
    infos = []
    for entry in sorted(LANGPACKS_ROOT.iterdir()):
        if not entry.is_dir() or not (entry / "config.yaml").exists():
            continue
        lp = get_langpack(entry.name)
        infos.append(LangpackInfo(code=entry.name, name=lp.name))
    return infos
