from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from srs import card_from_state, card_to_state, new_card, review

from ..config import settings
from ..db import get_db
from ..langpacks import get_langpack
from ..models import Card as CardRow

router = APIRouter(prefix="/review")


class ReviewItem(BaseModel):
    item_id: str
    item_type: str
    prompt: str
    reading: str
    meaning: str
    is_new: bool


class AnswerRequest(BaseModel):
    item_id: str
    rating: str  # "again" | "hard" | "good" | "easy"


@router.get("/next")
def next_item(langpack: str | None = None, db: Session = Depends(get_db)) -> ReviewItem | None:
    lp = get_langpack(langpack or settings.active_langpack)
    now = datetime.now(timezone.utc)

    due_row = (
        db.execute(
            select(CardRow)
            .where(CardRow.langpack == lp.code, CardRow.due_at <= now)
            .order_by(CardRow.due_at)
            .limit(1)
        )
        .scalars()
        .first()
    )
    if due_row is not None:
        item = lp.get_item(due_row.item_id)
        return _to_review_item(due_row.item_id, due_row.item_type, item, is_new=False)

    known_ids = set(
        db.execute(select(CardRow.item_id).where(CardRow.langpack == lp.code)).scalars().all()
    )
    for item_id, item_type in lp.all_items():
        if item_id not in known_ids:
            card = new_card()
            db.add(
                CardRow(
                    item_id=item_id,
                    langpack=lp.code,
                    item_type=item_type,
                    fsrs_state=card_to_state(card),
                    due_at=card.due,
                )
            )
            db.commit()
            item = lp.get_item(item_id)
            return _to_review_item(item_id, item_type, item, is_new=True)

    return None


@router.post("/answer")
def answer(req: AnswerRequest, db: Session = Depends(get_db)):
    row = db.execute(select(CardRow).where(CardRow.item_id == req.item_id)).scalars().first()
    if row is None:
        raise HTTPException(status_code=404, detail="card not found")

    card = card_from_state(row.fsrs_state)
    updated = review(card, req.rating)

    row.fsrs_state = card_to_state(updated)
    row.due_at = updated.due
    row.reps += 1
    if req.rating == "again":
        row.lapses += 1
    row.last_review_at = datetime.now(timezone.utc)
    db.commit()

    return {"item_id": req.item_id, "due_at": updated.due.isoformat()}


def _to_review_item(item_id: str, item_type: str, item, is_new: bool) -> ReviewItem:
    if item_type == "vocab":
        return ReviewItem(
            item_id=item_id, item_type=item_type, prompt=item.word,
            reading=item.reading, meaning=item.meaning, is_new=is_new,
        )
    return ReviewItem(
        item_id=item_id, item_type=item_type, prompt=item.text,
        reading=item.reading, meaning=item.translation, is_new=is_new,
    )
