import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from srs import card_from_state, card_to_state, new_card, review

from ..agents.deepseek_client import chat_completion
from ..agents.persona import build_messages
from ..db import get_db
from ..langpacks import get_langpack
from ..models import Card as CardRow
from ..models import ConversationLog, ReviewEvent
from ..models import Session as SessionRow
from ..units import cards_by_item_id

router = APIRouter(prefix="/chat")


class ChatRequest(BaseModel):
    session_id: uuid.UUID
    text: str


class ChatResponse(BaseModel):
    session_id: uuid.UUID
    reply: str


@router.post("/message")
def send_message(req: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    session_row = db.get(SessionRow, req.session_id)
    if session_row is None:
        raise HTTPException(status_code=404, detail="session not found")

    lp = get_langpack(session_row.langpack)
    unit = lp.get_unit(session_row.unit_id)

    history_rows = (
        db.execute(
            select(ConversationLog)
            .where(ConversationLog.session_id == req.session_id)
            .order_by(ConversationLog.created_at)
        )
        .scalars()
        .all()
    )
    history = [{"role": row.role, "content": row.content} for row in history_rows]

    messages = build_messages(session_row.langpack, unit, history, req.text)
    reply = chat_completion(messages)

    db.add(ConversationLog(session_id=req.session_id, langpack=session_row.langpack, role="user", content=req.text))
    db.add(ConversationLog(session_id=req.session_id, langpack=session_row.langpack, role="assistant", content=reply))

    _credit_words_used(db, lp, unit, req.session_id, req.text)

    db.commit()

    return ChatResponse(session_id=req.session_id, reply=reply)


def _credit_words_used(db: Session, lp, unit, session_id: uuid.UUID, user_text: str) -> None:
    """Algorithmic, not LLM: a unit word the learner actually typed/spoke is
    treated as a successful recall and fed into the same FSRS card review
    flow as the explicit review buttons use. Plain substring match - misses
    inflected/conjugated forms, but it's free and lets chat alone move a
    unit's confidence score, which is the whole point of letting chat count
    toward unlocking the next unit."""
    haystack = user_text.lower()
    cards_by_item = cards_by_item_id(db, lp.code)
    now = datetime.now(timezone.utc)

    for vocab_id in unit.vocab_ids:
        item_id = f"{lp.code}:vocab:{vocab_id}"
        word = lp.get_item(item_id).word
        if word.lower() not in haystack:
            continue

        row = cards_by_item.get(item_id)
        if row is None:
            card = new_card()
            row = CardRow(
                item_id=item_id, langpack=lp.code, item_type="vocab",
                fsrs_state=card_to_state(card), due_at=card.due,
                reps=0, lapses=0,
            )
            db.add(row)
        else:
            card = card_from_state(row.fsrs_state)

        updated = review(card, "good")
        row.fsrs_state = card_to_state(updated)
        row.due_at = updated.due
        row.reps += 1
        row.last_review_at = now

        db.add(ReviewEvent(session_id=session_id, item_id=item_id, rating="good", source="chat"))
