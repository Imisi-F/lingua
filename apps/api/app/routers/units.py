from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..units import units_with_progress

router = APIRouter(prefix="/units")


class UnitProgress(BaseModel):
    id: str
    name: str
    level: str
    word_count: int
    score: float
    unlocked: bool


@router.get("")
def list_units(langpack: str, db: Session = Depends(get_db)) -> list[UnitProgress]:
    return units_with_progress(db, langpack)
