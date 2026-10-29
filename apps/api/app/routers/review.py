import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from srs import card_from_state, card_to_state, new_card, review

from ..db import get_db
from ..langpacks import get_langpack
from ..models import Card as CardRow
from ..models import ReviewEvent
from ..models import Session as SessionRow

router = APIRouter(prefix="/review")


class ReviewItem(BaseModel):
    item_id: str
    item_type: str
    prompt: str
    reading: str
    meaning: str
    is_new: bool


class AnswerRequest(BaseModel):
    session_id: uuid.UUID
    item_id: str
    rating: str  # "again" | "hard" | "good" | "easy"


@router.get("/next")
def next_item(session_id: uuid.UUID, db: Session = Depends(get_db)) -> ReviewItem | None:
    session_row = db.get(SessionRow, session_id)
    if session_row is None:
        raise HTTPException(status_code=404, detail="session not found")

    lp = get_langpack(session_row.langpack)
    unit = lp.get_unit(session_row.unit_id)
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

    # Nothing due: introduce the next word from THIS unit specifically, not
    # the langpack's whole catalog - the unit is the point of the path.
    known_ids = set(
        db.execute(select(CardRow.item_id).where(CardRow.langpack == lp.code)).scalars().all()
    )
    for vocab_id in unit.vocab_ids:
        item_id = f"{lp.code}:vocab:{vocab_id}"
        if item_id not in known_ids:
            card = new_card()
            db.add(
                CardRow(
                    item_id=item_id,
                    langpack=lp.code,
                    item_type="vocab",
                    fsrs_state=card_to_state(card),
                    due_at=card.due,
                )
            )
            db.commit()
            item = lp.get_item(item_id)
            return _to_review_item(item_id, "vocab", item, is_new=True)

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

    db.add(ReviewEvent(session_id=req.session_id, item_id=req.item_id, rating=req.rating, source="review"))
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
