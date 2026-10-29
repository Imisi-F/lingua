import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from ..agents.deepseek_client import chat_completion
from ..db import get_db
from ..langpacks import get_langpack
from ..models import ConversationLog, ReviewEvent
from ..models import Session as SessionRow
from ..units import cards_by_item_id, unit_score

router = APIRouter(prefix="/sessions")


class StartRequest(BaseModel):
    langpack: str
    unit_id: str
    activity: str  # "chat" | "review"


class StartResponse(BaseModel):
    session_id: uuid.UUID


class SummaryResponse(BaseModel):
    session_id: uuid.UUID
    unit_name: str
    score: float
    feedback: str
    words_practiced: list[str]
    new_words: int
    duration_seconds: int


@router.post("/start")
def start_session(req: StartRequest, db: DbSession = Depends(get_db)) -> StartResponse:
    row = SessionRow(langpack=req.langpack, unit_id=req.unit_id, activity=req.activity)
    db.add(row)
    db.commit()
    return StartResponse(session_id=row.id)


@router.post("/{session_id}/end")
def end_session(session_id: uuid.UUID, db: DbSession = Depends(get_db)) -> SummaryResponse:
    session_row = db.get(SessionRow, session_id)
    if session_row is None:
        raise HTTPException(status_code=404, detail="session not found")

    now = datetime.now(timezone.utc)
    session_row.ended_at = now

    lp = get_langpack(session_row.langpack)
    unit = lp.get_unit(session_row.unit_id)
    cards_by_item = cards_by_item_id(db, session_row.langpack)
    score = unit_score(unit, session_row.langpack, cards_by_item)
    session_row.score = score

    events = (
        db.execute(select(ReviewEvent).where(ReviewEvent.session_id == session_id)).scalars().all()
    )
    touched_item_ids = sorted({e.item_id for e in events})

    words_practiced = []
    for item_id in touched_item_ids:
        try:
            item = lp.get_item(item_id)
        except KeyError:
            continue
        words_practiced.append(getattr(item, "word", None) or getattr(item, "text", ""))

    new_words = sum(
        1
        for item_id in touched_item_ids
        if (row := cards_by_item.get(item_id)) is not None
        and row.created_at is not None
        and row.created_at >= session_row.started_at
    )

    duration_seconds = int((now - session_row.started_at).total_seconds())

    feedback = _generate_feedback(unit.name, events, score)
    session_row.feedback = feedback

    db.commit()

    return SummaryResponse(
        session_id=session_id,
        unit_name=unit.name,
        score=round(score, 4),
        feedback=feedback,
        words_practiced=words_practiced,
        new_words=new_words,
        duration_seconds=duration_seconds,
    )


class SessionSummary(BaseModel):
    id: uuid.UUID
    langpack: str
    unit_id: str
    unit_name: str
    activity: str
    started_at: datetime
    score: float | None
    duration_seconds: int
    snippet: str


@router.get("")
def list_sessions(langpack: str | None = None, db: DbSession = Depends(get_db)) -> list[SessionSummary]:
    query = select(SessionRow).where(SessionRow.ended_at.is_not(None))
    if langpack:
        query = query.where(SessionRow.langpack == langpack)
    query = query.order_by(SessionRow.started_at.desc()).limit(50)
    rows = db.execute(query).scalars().all()

    results = []
    for row in rows:
        lp = get_langpack(row.langpack)
        try:
            unit_name = lp.get_unit(row.unit_id).name
        except KeyError:
            unit_name = row.unit_id

        duration = int(((row.ended_at or row.started_at) - row.started_at).total_seconds())
        results.append(
            SessionSummary(
                id=row.id,
                langpack=row.langpack,
                unit_id=row.unit_id,
                unit_name=unit_name,
                activity=row.activity,
                started_at=row.started_at,
                score=row.score,
                duration_seconds=duration,
                snippet=_session_snippet(db, row),
            )
        )
    return results


def _session_snippet(db: DbSession, row: SessionRow) -> str:
    if row.activity == "chat":
        last_msg = (
            db.execute(
                select(ConversationLog)
                .where(ConversationLog.session_id == row.id)
                .order_by(ConversationLog.created_at.desc())
                .limit(1)
            )
            .scalars()
            .first()
        )
        return last_msg.content if last_msg else ""

    events = db.execute(select(ReviewEvent).where(ReviewEvent.session_id == row.id)).scalars().all()
    if not events:
        return ""
    lp = get_langpack(row.langpack)
    words = []
    for item_id in sorted({e.item_id for e in events}):
        try:
            item = lp.get_item(item_id)
        except KeyError:
            continue
        words.append(getattr(item, "word", None) or getattr(item, "text", ""))
    return ", ".join(words[:5])


def _generate_feedback(unit_name: str, events: list[ReviewEvent], score: float) -> str:
    """The one LLM call in this whole feature, fired once per 'End session'
    click - not per message, not per review. Everything it's handed
    (ratings, score) is precomputed data, not something it judges itself."""
    if not events:
        return f"No words were practiced in {unit_name} this session."

    rating_lines = "\n".join(f"- {e.item_id.rsplit(':', 1)[-1]}: {e.rating}" for e in events)
    prompt = (
        f"A language learner just finished a practice session on the topic '{unit_name}'. "
        f"Their overall confidence score is {round(score * 100)}%. Here is how each word they "
        "practiced went (their own self-rated recall, from 'again' (forgot) to 'easy'):\n"
        f"{rating_lines}\n\n"
        "In 1-2 short sentences, tell them specifically what went well and what still needs "
        "work, based only on this data. Be concrete (name real words/patterns from the list), "
        "not generic praise. No greeting, no sign-off, just the feedback."
    )
    return chat_completion([{"role": "user", "content": prompt}])
